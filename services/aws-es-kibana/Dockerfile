FROM node:latest

RUN npm install aws-es-kibana -g
RUN mkdir -p /root/.aws && touch /root/.aws/credentials

EXPOSE 9200

ENTRYPOINT aws-es-kibana -s -b 0.0.0.0 $ES_ENDPOINT
