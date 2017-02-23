/**
 * This module defines Backbone.js models used by the filter builder
*/
var Backbone = require('backbone');

/** Model used to track when a field han been enabled in the UI.
 * Used to facilitate searching for enabled fields and sorting UI elements by
 * last enabled time.
 */
var FieldStateModel = Backbone.Model.extend({
  defaults: {
    state: null,
    lastEnabled: null,
  },
});

/** Model used to define fields in UI */
var Field = Backbone.Model.extend({
  defaults: {
    name: null,
    description: null,
    group: null,
    type: null, // range, enum, boolean
    min: 0,
    max: 100,
    value: null,
    enabled: null,
    uiFilter: 'False', // hide in UI
  },
  initialize: function initialize() {
    var type = this.escape('type');
    if (type.indexOf('range') === 0) {
      this.initRange(type);
    } else if (type.indexOf('enum') === 0) {
      this.initEnum(type);
    } else if (type.indexOf('bool') === 0) {
      this.initBool();
    } else if (type.indexOf('datetime') === 0) {
      this.initDateTimeRange();
    }

    this.set('enabled', new FieldStateModel());
  },
  initRange: function initRange(type) {
    var typeSplit = type.split(',');
    if (typeSplit.length < 4) {
      console.error('invalid range field:', this);
      this.trigger('error');
    }
    this.range_low = parseInt(typeSplit[1], 10);
    this.range_hi = parseInt(typeSplit[2], 10);
    this.range_step = parseFloat(typeSplit[3]);
    this.set('value', [this.range_low, this.range_hi]);
  },
  initEnum: function initEnum(type) {
    var values = type.split(',');
    values.shift();
    this.enumValues = values;
    this.set('value', []);
  },
  // initialise bool selectors to True
  initBool: function initBool() {
    this.set('value', 1);
  },
  initDateTimeRange: function initDateTimeRange() {
    var from = 0;
    var to = Date.now();
    this.set('value', [from, to]);
  },
});

/** Model used for grouping fields */
var GroupModel = Backbone.Model.extend({
  defaults: {
    name: null,
    displayName: null,
  },
});

module.exports = {
  FieldStateModel: FieldStateModel,
  Field: Field,
  GroupModel: GroupModel,
};
