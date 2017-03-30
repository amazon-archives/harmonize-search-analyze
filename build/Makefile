# environment file controls config parameters
CONFIG_ENV = ./config.env
include $(CONFIG_ENV)

# The ECS reference architecture is imported as a git submodule
# Its files are referenced from the submodule dir
ECS_REF_ARCH_DIR := ./ecs-refarch-cloudformation
ECS_REF_ARCH_TEMPLATES :=  $(wildcard $(ECS_REF_ARCH_DIR)/infrastructure/*.yaml)

# master template
MASTER_TEMPLATE := ../master.yaml

# infrastructure cfn templates defined in this environment
INFRASTRUCTURE_DIR := ../infrastructure
INFRASTRUCTURE_TEMPLATES := $(wildcard $(INFRASTRUCTURE_DIR)/*.yaml)

# Docker image definitions and related files are stored under this directory
SERVICES_DIR := ../services

# jupyter notebooks and libraries
NOTEBOOK_DIR := ../notebooks
NOTEBOOK_LIB_DIR := $(NOTEBOOK_DIR)/lib
NOTEBOOK_FILES := $(wildcard $(NOTEBOOK_DIR)/*.ipynb)
NOTEBOOK_FILES += $(wildcard $(NOTEBOOK_LIB_DIR)/*.py)

# EMR boostrap scripts
EMR_BOOTSTRAP_DIR := ../infrastructure/emr-bootstrap
EMR_BOOTSTRAP_FILES := $(wildcard $(BOOTSTRAP_DIR)/*.sh)

# files in this repo - used to upload src artifact to s3 for codebuild
SRC_FILES := $(shell git ls-files ..)

# build output directory
OUT := out
# put output dir in VPATH to simplify finding dependencies
VPATH := $(OUT)

.DELETE_ON_ERROR:

all: build
.PHONY: all

upload: upload-templates upload-emr-files upload-src-zip \
	 upload-config-env
.PHONY: upload

upload-templates: upload-master-template upload-ref-arch-templates \
	upload-infrastructure-templates
.PHONY: upload-templates

upload-emr-files: upload-notebooks upload-emr-bootstrap
.PHONY: upload-emr-files

# create the output directory for tracking dependencies
$(OUT):
	mkdir -p $(@)

upload-master-template: $(MASTER_TEMPLATE) | $(OUT)
	@echo "[INFO] uploading master template"
	aws s3 cp --acl public-read \
		$(MASTER_TEMPLATE) "s3://$(ENV_BUCKET_PATH)/infrastructure/master.yaml" | \
		tee -a $(OUT)/$(@)

upload-config-env: $(CONFIG_ENV) | $(OUT)
	@echo "[INFO] uploading environment config file"
	aws s3 cp --acl public-read \
		$(?) "s3://$(ENV_BUCKET_PATH)/build/config.env" | \
		tee -a $(OUT)/$(@)

upload-ref-arch-templates: $(ECS_REF_ARCH_TEMPLATES) | $(OUT)
	@[ -d $(ECS_REF_ARCH_DIR)/infrastructure ] || \
		echo "[INFO] cloning ecs reference architecture" ; \
		git submodule update --init $(ECS_REF_ARCH_DIR)
	@echo "[INFO] uploading ecs reference architecture templates"
	aws s3 sync --acl public-read  --exclude "*" --include "*.yaml" \
		$(ECS_REF_ARCH_DIR)/infrastructure "s3://$(ENV_BUCKET_PATH)/infrastructure" | \
		tee $(OUT)/$(@)

upload-infrastructure-templates: $(INFRASTRUCTURE_TEMPLATES) | $(OUT)
	@echo "[INFO] uploading architecture templates"
	aws s3 sync --acl public-read --exclude "*" --include "*.yaml" \
		$(INFRASTRUCTURE_DIR) "s3://$(ENV_BUCKET_PATH)/infrastructure/" | \
		tee $(OUT)/$(@)

upload-notebooks: $(NOTEBOOK_FILES) | $(OUT)
	@echo "[INFO] uploading Jupyter notebooks"
	aws s3 sync --acl public-read --exclude "*" --include "*.py" \
		--include "*.ipynb"  --include "*.json" --include "*.html" \
		$(NOTEBOOK_DIR) "s3://$(ENV_BUCKET_PATH)/notebooks/" | \
		tee -a $(OUT)/$(@)

upload-emr-bootstrap: $(EMR_BOOTSTRAP_FILES) | $(OUT)
	@echo "[INFO] uploading EMR boostrap scripts"
	aws s3 sync --acl public-read --exclude "*" --include "*.sh" \
		$(EMR_BOOTSTRAP_DIR) "s3://$(ENV_BUCKET_PATH)/infrastructure/emr-bootstrap/" | \
		tee -a $(OUT)/$(@)

SRC_ZIP := $(OUT)/src.zip
$(SRC_ZIP): $(SRC_FILES) | $(OUT)
	@echo "[INFO] creating git repo archive"
	cd .. && git archive --format=zip HEAD > build/$(@)

upload-src-zip: $(SRC_ZIP) | $(OUT)
	@echo "[INFO] uploading git repo archive"
	aws s3 cp --acl public-read \
		$(OUT)/src.zip "s3://$(ENV_BUCKET_PATH)/src.zip" | tee -a $(OUT)/$(@)

# to be used after pushing images to force a new task definition revision
register-task-definition:
	[ ! -z "$$(aws ecs list-task-definitions --family-prefix $(ENV_NAME) --query taskDefinitionArns --output text)" ] && \
		aws ecs register-task-definition --family $(ENV_NAME) \
		--container-definitions \
		"$$(aws ecs describe-task-definition --task-definition \
		$$(aws ecs list-task-definitions --family-prefix $(ENV_NAME) --query taskDefinitionArns[-1] --output text) --query taskDefinition.containerDefinitions)"
.PHONY: register-task-definition

config-env.json: $(CONFIG_ENV) | $(OUT)
	@printf '{"ENV_VERSION": "$(ENV_VERSION)"}' > $(OUT)/$(@)

build:
	@echo "[INFO] building docker images"
	@$(MAKE) -C $(SERVICES_DIR)/kibana build
	@$(MAKE) -C $(SERVICES_DIR)/nginx build
	@$(MAKE) -C $(SERVICES_DIR)/aws-es-kibana build
	@$(MAKE) -C $(SERVICES_DIR)/webapp build
.PHONY: build

push:
	@echo "[INFO] pushing docker images"
	@$(MAKE) -C $(SERVICES_DIR)/kibana push
	@$(MAKE) -C $(SERVICES_DIR)/nginx push
	@$(MAKE) -C $(SERVICES_DIR)/aws-es-kibana push
	@$(MAKE) -C $(SERVICES_DIR)/webapp push
.PHONY: push

push-latest:
	@echo "[INFO] pushing docker images and tagging as latest"
	@$(MAKE) -C $(SERVICES_DIR)/kibana push-latest
	@$(MAKE) -C $(SERVICES_DIR)/nginx push-latest
	@$(MAKE) -C $(SERVICES_DIR)/aws-es-kibana push-latest
	@$(MAKE) -C $(SERVICES_DIR)/webapp push-latest
.PHONY: push-latest

clean:
	-rm -f $(OUT)/*
.PHONY: clean
