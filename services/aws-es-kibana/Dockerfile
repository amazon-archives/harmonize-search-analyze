FROM node:latest

RUN npm install aws-es-kibana -g

EXPOSE 9200

ENTRYPOINT aws-es-kibana -s -b 0.0.0.0 $ES_ENDPOINT
