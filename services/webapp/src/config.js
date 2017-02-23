/**
 * Configure and initialize elements in the DOM.
 * This includes setting the Kibana iframe and a the Elasticsearch link.
 */
var $ = require('jquery');

/*
 * Elasticsearch endpoint url prefix. Uses Kibana as a proxy.
 * Elasticsearch queries are appended to the "source" variable
 * in the URL query string. For example:
 *   /kibana/elasticsearch/_search?source=<query>
 */
var esUrlPrefix = '/kibana/elasticsearch/';

// Elasticsearch index wildcard
var dataIndexWildcard = '*harmonized*';

// link element ID for the Elasticsearch data URL
var dataLinkId = 'es-data-url';

// Elasticsearch dictionary index wildcard
var dictIndexWildcard = '*dictionary*';

// link element ID for the Elasticsearch dictionary URL
var dictLinkId = 'es-dict-url';

// Kibana iframe element ID. This is referenced in the views
var kibanaIframeId = 'kibana-iframe';

// Kibana iframe embed URL. This URL is obtained from Kibana > Dashboard > Share
var dashboardEmbedUrl =
  '/kibana/app/kibana#/dashboard/IncidentDashboard?embed=true&_g=(refreshInterval%3A(display%3AOff%2Cpause%3A!f%2Cvalue%3A0)%2Ctime%3A(from%3Anow-20y%2Cmode%3Aquick%2Cto%3Anow))';

/**
* Append link and iframe to the DOM
*/
module.exports = function appendElements() {
  /*
   * Append links to the DOM with Elasticsearch endpoint urls. These link are
   * used by filter-builder to dyamically discover the Elasticsearch endpoint.
   *
   */
  $('head').append($('<link>', {
    id: dataLinkId,
    rel: dataLinkId,
    href: esUrlPrefix + dataIndexWildcard + '/_search?source=',
  }));
  $('head').append($('<link>', {
    id: dictLinkId,
    rel: dictLinkId,
    href: esUrlPrefix + dictIndexWildcard + '/_search?source=',
  }));

  // Append Kibana hidden iframe to the DOM
  $('#kibana-iframe-container').append($('<iframe>', {
    id: kibanaIframeId,
    src: dashboardEmbedUrl,
    style: 'display: none;',
  }));
};
