/**
 * This module defines Backbone.js views used to build the accordion UI
*/

var $ = require('jquery');
var _ = require('underscore');
var Backbone = require('backbone');

require('bootstrap/dist/css/bootstrap.css');
require('bootstrap/dist/js/bootstrap.js');

require('bootstrap-slider/dist/css/bootstrap-slider.css');
require('bootstrap-slider');

require('bootstrap-multiselect/dist/css/bootstrap-multiselect.css');
require('bootstrap-multiselect');

require('bootstrap-3-typeahead');

require('moment');
require('bootstrap/js/transition.js');
require('bootstrap/js/collapse.js');
require('eonasdan-bootstrap-datetimepicker/src/js/bootstrap-datetimepicker.js');
require('eonasdan-bootstrap-datetimepicker/build/css/bootstrap-datetimepicker.css');

var FieldStateModel = require('./models').FieldStateModel;

var KibanaView = Backbone.View.extend({
  el: '#kibana-iframe',
  initialize: function initialize() {
    var self = this;

    this.$queryField = $('#query-field');

    $.when(this.waitForAngularReload(self), this.waitForKibana(self))
    .done(function hideWidgets(status) {
      console.log('hideWidgets status:', status);
      self.$queryInputForm = self.$el.contents().find('[name="queryInput"]');
      self.$queryInput = self.$queryInputForm.find('input');
      self.$queryField.val('*');
      self.render();
    })
    .fail(function showError(status) {
      console.error(status);
    });
  },
  // This is needed to be able to access angular's scope
  waitForAngularReload: function waitForAngularReload(self) {
    var checkInterval;
    var failTimeout;

    var deferred = new $.Deferred();

    checkInterval = setInterval(function findIframe() {
      if ($(self.$el).prop('contentWindow').angular) {
        $(self.$el).show();
        $(self.$el).prop('contentWindow').angular.reloadWithDebugInfo();
        clearInterval(checkInterval);
        if (failTimeout) {
          clearTimeout(failTimeout);
        }
        deferred.resolve('embedded kibana iframe - angular loaded');
      }
    }, 250);

    failTimeout = setTimeout(function handleFailTimeout() {
      deferred.reject('failed to load angular in kibana frame');
      clearInterval(checkInterval);
    }, 10000);

    return deferred.promise();
  },
  waitForKibana: function waitForKibana(self) {
    var checkInterval;
    var failTimeout;

    var deferred = new $.Deferred();

    checkInterval = setInterval(function findIframe() {
      if ($(self.$el).prop('contentWindow').angular &&
          $(self.$el).contents().find('[name="queryInput"]').find('input').length) {
        clearInterval(checkInterval);
        if (failTimeout) {
          clearTimeout(failTimeout);
        }
        deferred.resolve('embedded kibana iframe loaded - showing input field');
      }
    }, 1000);

    failTimeout = setTimeout(function handleFailTimeout() {
      deferred.reject('failed to load kibana frame');
      clearInterval(checkInterval);
    }, 25000);

    return deferred.promise();
  },
  render: function render() {
    var query = this.collection.generateQuery();
    var queryDisplayText = this.collection.generateQueryDisplayText();
    this.setKibanaQuery(query, queryDisplayText);
    return this;
  },
  setKibanaQuery: function setKibanaQuery(kibanaQuery, kibanaQueryDisplayText) {
    var ngScope;

    if (!_.isUndefined(this.$queryInput) && this.$queryInput.length) {
      ngScope = this.$el.prop('contentWindow').angular
        .element(this.$queryInputForm).scope();
      ngScope.$apply(function setQuery() {
        ngScope.state.query = kibanaQuery;
      });
      this.$queryField.val(kibanaQueryDisplayText);
      ngScope.filterResults();
    }
  },
});

var ResetButtonView = Backbone.View.extend({
  tagName: 'div',
  className: 'reset-container',
  events: {
    'click [type=button]': 'onClickButton',
  },
  render: function render() {
    this.$el.attr('id', 'reset-container');
    var $button = $('<input>)', {
      id: 'filterUI.reset',
      type: 'button',
      class: 'btn btn-default',
      value: 'Reset Filters',
    });
    $button.appendTo(this.$el);
    return this;
  },
  onClickButton: function onClickButton() {
    this.collection.query = { match_all: {} };
    this.collection.queryDisplayText = '*';
    this.collection.reset();
    this.collection.fetch();
  },
});

var RangeView = Backbone.View.extend({
  tagName: 'div',
  className: 'range-container',
  events: {
    'slideStop .slider': 'onSlideStop',
  },
  render: function render() {
    this.$el.attr('id', 'range-container-' + this.model.cid);

    var $input = $('<input>', { id: 'slider-' + this.model.cid });
    $input.appendTo(this.$el);

    var value = this.model.get('value');
    $input.slider({
      id: 'slider-range-' + this.model.cid,
      min: this.model.range_low,
      max: this.model.range_hi,
      step: this.model.range_step,
      range: true,
      value: [value[0], value[1]],
    });
    return this;
  },
  onSlideStop: function onSlideStop(evt) {
    var min = evt.value[0];
    var max = evt.value[1];
    min = parseFloat(_.escape(min));
    max = parseFloat(_.escape(max));
    this.model.set('value', [min, max]);
  },
});

var EnumView = Backbone.View.extend({
  tagName: 'div',
  className: 'enum-container',
  events: {
    'change .multiselect-container': 'onMultiSelectChange',
  },
  render: function render() {
    this.$el.attr('id', 'enum-container-' + this.model.cid);

    var $select = $('<select>', {
      id: 'select-' + this.model.cid,
      multiple: 'multiple',
    });
    $select.appendTo(this.$el);

    var values = this.model.enumValues;
    _.each(values, function appendOption(value) {
      var escapedVal = _.escape(value);
      var $option = $('<option>', { value: escapedVal }).text(escapedVal);
      $select.append($option);
    });

    $select.multiselect();

    // XXX workaround for style issues
    this.$el.find('.multiselect').removeClass('dropdown-toggle');

    return this;
  },
  onMultiSelectChange: function onMultiSelectChange() {
    var selectedValues = _.map(this.$el.find(':selected'), function getSelected(el) {
      return $(el).val();
    });

    this.model.set('value', selectedValues);
  },
});

var BoolView = Backbone.View.extend({
  tagName: 'div',
  className: 'bool-container',
  events: {
    'change [type=radio]': 'onBoolChange',
  },
  render: function render() {
    this.$el.attr('id', 'bool-container-' + this.model.cid);

    _.each(['True', 'False'], function appendBool(bool) {
      var $label = $('<label>', {
        name: 'radio-' + this.model.cid,
        class: 'radio-inline',
      });
      var $input = $('<input>', {
        type: 'radio',
        name: 'radio-' + this.model.cid,
        id: 'radio-' + this.model.cid + '-' + bool,
        value: bool,
        checked: (bool === 'True'),
      });
      $label.append($input);
      $label.append(bool);
      $label.appendTo(this.$el);
    }, this);

    return this;
  },
  onBoolChange: function onBoolChange(evt) {
    var $target = $(evt.target);
    var val = $target.val().toLowerCase();

    if (val === 'true') {
      this.model.set('value', 1);
    } else if (val === 'false') {
      this.model.set('value', 0);
    }
  },
});

var DateTimeView = Backbone.View.extend({
  tagName: 'div',
  className: 'datetime-container',
  events: {
    'dp.change .input-group': 'onDateTimeChange',
  },
  render: function render() {
    this.$el.attr('id', 'datetime-container-' + this.model.cid);

    var $formGroupFrom = $('<div>', {
      class: 'form-group',
    });

    var $inputGroupFrom = $('<div>', {
      id: 'datetime-picker-from-' + this.model.cid,
      class: 'input-group date',
    });

    var $inputFrom = $('<input>', {
      type: 'text',
      id: 'datetime-picker-from-' + this.model.cid,
      class: 'form-control date-from',
    });
    var $labelFrom = $('<label>', {
      for: 'datetime-picker-from-' + this.model.cid,
      class: 'col-form-label pull-left',
    });
    $labelFrom.text('From');

    var $formGroupTo = $('<div>', {
      class: 'form-group',
    });
    var $inputGroupTo = $('<div>', {
      id: 'datetime-picker-to-' + this.model.cid,
      class: 'input-group date',
    });
    var $inputTo = $('<input>', {
      type: 'text',
      id: 'datetime-picker-to-' + this.model.cid,
      class: 'form-control date-to',
    });
    var $labelTo = $('<label>', {
      for: 'datetime-picker-to-' + this.model.cid,
      class: 'col-form-label pull-left',
    });
    $labelTo.text('To');

    $inputGroupFrom.append($labelFrom);
    $inputGroupFrom.append($inputFrom);
    $formGroupFrom.append($inputGroupFrom).appendTo(this.$el);

    $inputGroupTo.append($labelTo);
    $inputGroupTo.append($inputTo);
    $formGroupTo.append($inputGroupTo).appendTo(this.$el);

    $inputFrom.datetimepicker();
    $inputTo.datetimepicker();

    return this;
  },
  onDateTimeChange: function onDateTimeChange(evt) {
    var eventDate = evt.date.valueOf();
    var currentValue = this.model.get('value');
    var currentFrom = currentValue[0];
    var currentTo = currentValue[1];
    var value = [];

    if ($(evt.target).hasClass('date-from')) {
      value = [eventDate, currentTo];
    } else if ($(evt.target).hasClass('date-to')) {
      value = [currentFrom, eventDate];
    }

    this.model.set('value', value);
  },
});

var TextView = Backbone.View.extend({
  tagName: 'div',
  className: 'text-container',
  events: {
    'input [type=text]': 'onTextInput',
  },
  render: function render() {
    this.$el.attr('id', 'text-container-' + this.model.cid);

    var $input = $('<input>', {
      type: 'text',
      id: 'input-' + this.model.cid,
      class: 'form-control',
      'data-provide': 'typeahead',
      autocomplete: 'off',
    });

    this.typeAheadUrl = this.getTypeAheadUrl();

    var self = this;
    $input.typeahead({
      minLength: 0,
      showHintOnFocus: true,
      items: 'all',
      source: function source(query, process) {
        self.requestTypeAhead(self, query, process);
      },
      afterSelect: function afterSelect(data) {
        self.model.set('value', data);
      },
    });

    $input.appendTo(this.$el);

    return this;
  },
  getTypeAheadUrl: function typeAheadUrl() {
    var url = $('#es-data-url').attr('href');
    if (!url) {
      console.error('failed to obtain typeahead url.');
      return null;
    }
    return url;
  },
  onTextInput: function onTextInput(evt) {
    var $target = $(evt.target);
    this.model.set('value', $target.val());
  },
  requestTypeAhead: function requestTypeAhead(self, value, process) {
    var obj = {};
    var field = self.model.get('name');
    // elasticsearch query
    var query = {
      size: 0,
      aggs: {
        suggestions: {
          terms: {
            field: field,
            size: 10,
          },
        },
      },
    };

    if (value.length > 0) {
      obj[field + '.split'] = value;
      query.query = {
        match_phrase_prefix: obj,
      };
    }
    var source = JSON.stringify(query);
    $.ajax({
      url: self.typeAheadUrl + source,
      dataType: 'json',
      type: 'GET',
      success: function success(data) {
        var arr = data.aggregations.suggestions.buckets.map(function getKey(el) {
          return el.key;
        });
        process(arr);
      },
    });
  },
});


var FieldView = Backbone.View.extend({
  tagName: 'div',
  className: 'field-container input-group',
  events: {
    'change .input-checkbox': 'onChangeCheckBox',
  },
  render: function render() {
    this.$el.attr('id', 'field-container-' + this.model.cid);
    var $heading = $('<div>', { class: 'checkbox field-checkbox' });

    var $label = $('<label>', {
      class: 'checkbox-inline',
      'data-toggle': 'tooltip',
      'data-placement': 'top',
      title: this.model.escape('description'),
    });

    var $input = $('<input>', {
      id: 'checkbox-' + this.model.cid,
      type: 'checkbox',
      class: 'input-checkbox',
    });

    $input.appendTo($label);
    $label.append(this.model.escape('name'));
    $label.appendTo($heading);
    $heading.appendTo(this.$el);

    var $widgetContainer = $('<div>', {
      id: 'widget-container-' + this.model.cid,
      class: 'well-sm',
      style: 'display: none;',
    });

    this.$widget = $widgetContainer;

    $widgetContainer.appendTo(this.$el);

    var type = this.model.get('type');
    var view;
    if (type.indexOf('range') === 0) {
      view = new RangeView({ model: this.model });
    } else if (type.indexOf('enum') === 0) {
      view = new EnumView({ model: this.model });
    } else if (type.indexOf('bool') === 0) {
      view = new BoolView({ model: this.model });
    } else if (type.indexOf('datetime') === 0) {
      view = new DateTimeView({ model: this.model });
    } else {
      view = new TextView({ model: this.model });
    }

    if (view) {
      $widgetContainer.append(view.render().$el);
    }

    return this;
  },
  onChangeCheckBox: function onChangeCheckBox(evt) {
    var $target = $(evt.target);
    var checked = $target.is(':checked');

    var enabled = new FieldStateModel();
    enabled.set('lastEnabled', new Date().getTime());
    enabled.set('state', checked);

    this.model.set('enabled', enabled);

    if (checked) {
      this.$widget.show();
    } else {
      this.$widget.hide();
    }
  },
});

var FilterAccordionView = Backbone.View.extend({
  el: '#filter-accordion-container',
  events: {
    'hidden.bs.collapse': 'toggleChevron',
    'shown.bs.collapse': 'toggleChevron',
  },
  initialize: function initialize() {
    this.listenTo(this.collection, 'error', function showAlert() {
      var alertEl =
        '<div class="alert alert-danger" role="alert">Failed to load fields' +
        '</div>';
      this.$el.html(alertEl);
    });

    this.kibanaView = new KibanaView({ collection: this.collection });
    this.listenTo(this.collection, 'sync', function handleSync() {
      this.render();
      this.kibanaView.render();
    });

    this.listenTo(this.collection, 'change', function handleChange() {
      this.kibanaView.render();
    });
  },
  render: function render() {
    this.$el.html('');
    this.panelGroup = $('<div>', { class: 'panel-group' })
      .appendTo(this.$el);
    this.renderPanel();

    this.resetButtonView = new ResetButtonView({ collection: this.collection });

    $(this.resetButtonView.render().$el).appendTo(this.$el);

    return this;
  },
  renderPanel: function renderPanel() {
    _.each(this.collection.groupCollection.models, function renderGroup(groupModel) {
      var $panel = $('<div>', {
        id: 'panel-' + groupModel.cid,
        class: 'panel panel-default',
        style: 'overflow:visible;',
      });

      this.renderPanelHeading($panel, groupModel);
      this.renderPanelBody($panel, groupModel);

      $panel.appendTo(this.panelGroup);
    }, this);
  },
  renderPanelHeading: function renderPanelHeading($panel, groupModel) {
    var $panelHeading = $('<div>', {
      id: 'heading-' + groupModel.cid,
      class: 'panel-heading',
    });

    var $panelTitle = $('<h4>', { class: 'panel-title' });
    var $panelLink = $('<a>', {
      'data-toggle': 'collapse',
      'data-parent': this.$el.attr('id'),
      href: '#collapse-' + groupModel.cid,
    });
    $panelLink.text(groupModel.escape('displayName'));
    $panelLink.append($('<span>', {
      class: 'glyphicon glyphicon-chevron-right pull-right',
    }));

    $panelTitle.append($panelLink).appendTo($panelHeading);
    $panel.append($panelHeading);
  },
  toggleChevron: function toggleChevron(evt) {
    $(evt.target)
      .prev('.panel-heading')
      .find('span.glyphicon')
      .toggleClass('glyphicon-chevron-down glyphicon-chevron-right');
  },
  renderPanelBody: function renderPanelBody($panel, groupModel) {
    var $panelCollapse = $('<div>', {
      id: 'collapse-' + groupModel.cid,
      class: 'panel-collapse collapse',
    });
    var $panelBody = $('<div>', { class: 'panel-body' });

    $panelCollapse.append($panelBody);

    $panel.append($panelCollapse);

    var models = this.collection.where({ group: groupModel.escape('name') });

    _.each(models, function appendField(model) {
      if (model.get('uiFilter') === 'True') {
        var fieldView = new FieldView({ model: model });
        $panelBody.append(fieldView.render().$el);
      }
    }, this);
  },
});

module.exports = {
  FilterAccordionView: FilterAccordionView,
};
