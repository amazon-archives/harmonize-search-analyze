# This makefile is used to build and push docker images. I also serves as a
# wrapper to docker-compose to run nginx, Kibana, aws-es-kibana, and the
# webapp locally

# project wide environment
CONFIG_ENV := ../build/config.env
include $(CONFIG_ENV)

all: build-local
.PHONY: all

# the following exports are used for local development with docker-compose

# credentials from profile passed to local aws-es-kibana proxy
export AWS_ACCESS_KEY_ID ?= $(shell aws configure get \
    "$(AWS_DEFAULT_PROFILE).aws_access_key_id")
export AWS_SECRET_ACCESS_KEY ?= $(shell aws configure get \
    "$(AWS_DEFAULT_PROFILE).aws_secret_access_key")

# Elasticsearch endpoint is passed to the aws-es-kibana proxy
export ES_ENDPOINT ?= $(shell aws cloudformation list-exports \
	--query 'Exports[?Name == `$(ENV_NAME)-ElasticsearchDomainEndpoint`].Value' \
	--output text | head -1)

export ENV_NAME ENV_VERSION LOCAL_PROXY_PORT

# web app dist dir - volume mounted for local dev
export VOLUME_DIR ?= $(CURDIR)/webapp

build-local: ./docker-compose.yml $(CONFIG_ENV)
	@echo "[INFO] Building local images using docker-compose"
	@docker-compose build --force-rm
.PHONY: build-local

up: build-local
	@echo "[INFO] Running environment locally using docker-compose"
	@echo "[INFO] NGINX proxy on localhost port: [$(LOCAL_PROXY_PORT)]"
	@echo "[INFO] aws-es-kibana proxy using access key: [$(AWS_ACCESS_KEY_ID)]"
	@echo "[INFO] pointing to Elasticsearch endpoint: [$(ES_ENDPOINT)]"
	@echo "[INFO] mounting volume: [$(VOLUME_DIR)] on proxy html dir"
	@-docker-compose up
.PHONY: up

ps:
	@-docker-compose ps
.PHONY: ps

logs:
	@-docker-compose logs
.PHONY: logs

down:
	@-docker-compose down --remove-orphans --rmi local -v
.PHONY: down

build:
	@$(MAKE) -C kibana build
	@$(MAKE) -C nginx build
	@$(MAKE) -C aws-es-kibana build
	@$(MAKE) -C webapp build
.PHONY: build

push: build
	@$(MAKE) -C aws-es-kibana push
	@$(MAKE) -C kibana push
	@$(MAKE) -C nginx push
	@$(MAKE) -C webapp push
.PHONY: push

clean: down
	@$(MAKE) -C aws-es-kibana clean
	@$(MAKE) -C kibana clean
	@$(MAKE) -C nginx clean
	@$(MAKE) -C webapp clean
.PHONY: clean

distclean: clean
	@$(MAKE) -C aws-es-kibana distclean
	@$(MAKE) -C kibana distclean
	@$(MAKE) -C nginx distclean
	@$(MAKE) -C webapp distclean
.PHONY: distclean
