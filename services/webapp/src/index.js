/**
 * Builds a data driven filter UI.
 * It uses Backbone.js to manage the model, collections and views.
 * The filter UI is built from a dictionary of data types stored in in
 * Elasticsearch.
 * It composes an accordion UI which is appended to a div element with id:
 *   "filter-accordion-container".
 * The filter UI drives the queries in a Kibana iframe with id:
 *   "kibana-iframe".
 * It gets the Elasticsearch endpoint from a link element with id:
 *   "es-url".
 */

var config = require('./config');

var collections = require('./collections');
var views = require('./views');

var FieldCollection = collections.FieldCollection;
var FilterAccordionView = views.FilterAccordionView;

// config the iframe and Elasticsearch endpoint in the DOM
config();

// initializes a collection of UI fields from Elasticsearch
var fieldCollection = new FieldCollection();

// initializes the view of the filter UI
var filterView = new FilterAccordionView({ collection: fieldCollection });
