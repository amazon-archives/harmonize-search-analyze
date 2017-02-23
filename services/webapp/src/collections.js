/**
 * This module defines Backbone.js collections used by the filter ui
*/
var Backbone = require('backbone');
var _ = require('underscore');
var $ = require('jquery');

var models = require('./models');

var Field = models.Field;
var GroupModel = models.GroupModel;

/**
 * Collection of Field Groups
 * This is a utility used to get groups from all the fields
 */
var GroupCollection = Backbone.Collection.extend({
  model: GroupModel,
  parse: function parse(groups) {
    return _.map(groups, function parseGroup(group) {
      // XXX harmonized group name uses a number prefix for sorting - remove
      var groupMatch = /^\d+\.(.+)/.exec(group);
      var groupDisplay = (groupMatch) ? groupMatch[1] : group;
      return ({ name: group, displayName: groupDisplay });
    });
  },
});

/**
 * Collection of fields.
 * It retrieves and parses the fields from Elasticsearch and manages the
 * creation of Kibana queries.
 */
var FieldCollection = Backbone.Collection.extend({
  model: Field,
  // makes entries unique based on group and name
  modelId: function modelId(attrs) {
    return attrs.group + attrs.name;
  },
  // makes entries sorted by group and name
  comparator: function comparator(field) {
    return field.get('group') + field.get('name');
  },
  initialize: function initialize() {
    this.fetch();

    this.groupCollection = null;
    this.listenTo(this, 'sync', function addGroupCollection() {
      this.groupCollection = new
        GroupCollection(this.groups(), { parse: true });
    });
    this.listenToOnce(this, 'error', function triggerError() {
      this.trigger('error');
      console.error('field collection init fetch failed');
    });

    this.query = { match_all: {} };
    this.queryDisplayText = '*';
  },
  fetch: function fetch(options) {
    options = options || {};
    _.defaults(options, this.fetchOpts());
    return Backbone.Collection.prototype.fetch.call(this, options);
  },
  url: function url() {
    var esQuery = JSON.stringify({
      size: 1000,
      _source: [
        'dict_field',
        'dict_vargroup',
        'dict_vartype',
        'dict_vardescr',
        'dict_min',
        'dict_max',
        'dict_countDistinct',
        'dict_uifilter',
      ],
      query: {
        query_string: { query: 'dict_field:*' },
      },
    });
    var esUrl = $('#es-dict-url').attr('href');
    if (!esUrl) {
      console.error('failed to obtain es url endpoint.');
      return null;
    }
    return esUrl + esQuery;
  },
  fetchOpts: function fetchOpts() {
    return {
      type: 'GET',
      dataType: 'json',
      contentType: 'application/json; charset=utf-8',
    };
  },
  parse: function parse(data) {
    var fields;
    if (!_.has(data, 'hits') || !_.has(data.hits, 'hits')) {
      console.error('Elastic Search did not return hits object');
      this.trigger('error');
      return null;
    }
    fields = _.pluck(data.hits.hits, '_source');

    return this.parseFields(fields);
  },
  parseFields: function parseFields(fields) {
    return _.map(fields, function validateField(f) {
      if (!this.isValidField(f)) {
        console.error('Invalid field: ', f);
        this.trigger('error');
        return null;
      }
      return ({
        name: f.dict_field,
        description: f.dict_vardescr,
        group: f.dict_vargroup,
        type: f.dict_vartype,
        uiFilter: f.dict_uifilter,
      });
    }, this);
  },
  isValidField: function isValidField(field) {
    var expectedFields =
      ['dict_field', 'dict_vardescr', 'dict_vargroup', 'dict_vartype', 'dict_uifilter'];
    return _.every(expectedFields, function validate(fieldName) {
      return _.has(field, fieldName);
    });
  },
  groups: function groups() {
    return _.chain(this.groupBy('group')).keys().sort().value();
  },
  enabledValueFields: function enabledValueFields() {
    var fields = this.filter(function checkEnabled(field) {
      var value = field.get('value');

      var isEnabled = (!_.isNull(field.get('enabled')) &&
        field.get('enabled').get('state') === true &&
        !_.isNull(value) && !(_.isArray(value) && _.isEmpty(value)));
      return isEnabled;
    });
    return _.sortBy(fields, function getLastEnabled(field) {
      return field.get('enabled').get('lastEnabled');
    });
  },
  generateQuery: function generateQuery() {
    var defaultQuery = { match_all: {} };
    var generatedQueryList = [];

    _.each(this.enabledValueFields(), function processField(field) {
      var name = field.escape('name');
      var value = field.get('value');
      var type = field.get('type');

      var query = {};
      var match = {};

      if (type.indexOf('range') === 0) {
        query[name] = { gte: value[0], lte: value[1] };
        generatedQueryList.push({ range: query });
      } else if (type.indexOf('enum') === 0) {
        var enumQueryList = [];
        _.each(value, function buildEnumQuery(val) {
          var match = {};
          match[name] = val;
          enumQueryList.push({ match: match });
        });
        var enumQuery = {
          bool: {
            should: enumQueryList,
            minimum_should_match: 1,
          },
        };
        generatedQueryList.push(enumQuery);
      } else if (type.indexOf('bool') === 0) {
        match[name] = value;
        generatedQueryList.push({ match: match });
      } else if (type.indexOf('datetime') === 0) {
        query[name] = {
          from: value[0],
          to: value[1],
          format: 'epoch_millis',
        };
        generatedQueryList.push({ range: query });
      } else if (value.length > 0) {
        // treat as text - default
        query[name + '.split'] = value;
        generatedQueryList.push({
          match_phrase_prefix: query,
        });
      }
    }, this);

    var generatedQuery;
    if (generatedQueryList.length > 0) {
      generatedQuery = { bool: { must: generatedQueryList } };
    } else {
      generatedQuery = defaultQuery;
    }

    if (generatedQuery === this.query) {
      return this.query;
    }

    this.query = generatedQuery;

    return this.query;
  },
  generateQueryDisplayText: function generateQueryDisplayText() {
    var queryDisplayText = '';

    _.each(this.enabledValueFields(), function processField(field, index) {
      // escape spaces in variable name
      var name = field.escape('name').replace(/[\s]/g, '\\ ');
      var value = field.get('value');
      var type = field.get('type');

      if (index) {
        queryDisplayText += ' AND ';
      }

      if (type.indexOf('range') === 0) {
        queryDisplayText += name + ':>=' + _.escape(value[0]) + ' AND ' +
          name + ':<=' + _.escape(value[1]);
      } else if (type.indexOf('enum') === 0) {
        var enumQuery = ' ';

        _.each(value, function createEnumQuery(value, index) {
          if (index) {
            enumQuery += ' OR ';
          }
          enumQuery += name + ':"' + value + '"';
        });

        if (value.length > 1) {
          enumQuery = '(' + enumQuery + ')';
        }
        queryDisplayText += enumQuery;
      } else if (type.indexOf('bool') === 0) {
        queryDisplayText += name + ':' + value;
      } else if (type.indexOf('datetime') === 0) {
        queryDisplayText += name + ':>=' + _.escape(value[0]) + ' AND ' +
          name + ':<=' + _.escape(value[1]);
      } else if (value.length > 0) {
        // default to text
        queryDisplayText += name + ':"* ' + value + '*"';
      }
    }, this);

    if (queryDisplayText === this.queryDisplayText) {
      return this.queryDisplayText;
    }

    this.queryDisplayText = (queryDisplayText === '') ? '*' : queryDisplayText;

    return this.queryDisplayText;
  },
});

module.exports = {
  FieldCollection: FieldCollection,
};
