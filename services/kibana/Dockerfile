# latest version compatible with AWS Elasticsearch Service 5.1
FROM kibana:5.1.1

ENV KIBANA_CONF_DIR=/etc/kibana

COPY config/kibana.yml "${KIBANA_CONF_DIR}/kibana.yml"

RUN chmod 644 "${KIBANA_CONF_DIR}/kibana.yml"
