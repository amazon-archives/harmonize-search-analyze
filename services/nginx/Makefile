# project wide environment
CONFIG_ENV := ../../build/config.env
include $(CONFIG_ENV)

# the ENV name should match the repository prefix used in the ecr.yaml template
IMAGE_NAME := $(ENV_NAME)/nginx

SERVICE_CONFIG_DIR := ./config
SERVICE_CONFIG_FILES := $(SERVICE_CONFIG_DIR)/default.conf

# build output directory
OUT := out

# put the output directory in vpath to simplify dependency searching
VPATH := $(OUT)

.DELETE_ON_ERROR:

all: build
.PHONY: all

# create the output directory for tracking dependencies
# use it as a order-only prerequisite dependency (using |)
$(OUT):
	mkdir -p $(@)

build: Dockerfile $(CONFIG_ENV) $(SERVICE_CONFIG_FILES) | $(OUT)
	@echo "[INFO] Building docker image: [$(IMAGE_NAME)]"
	docker build --pull --rm -t $(IMAGE_NAME):$(ENV_VERSION) . | tee $(OUT)/$(@)

# tag images
tag-latest: build
	@echo "[INFO] Tagging Docker image as latest: [$(IMAGE_NAME):$(ENV_VERSION)]"
	docker tag $(IMAGE_NAME):$(ENV_VERSION) $(IMAGE_NAME):latest | tee $(OUT)/$(@)

tag-repo: tag-latest ecr-repo-uri
	@echo "[INFO] Tagging Docker image into registry repository:" \
		"[$(IMAGE_NAME):$(ENV_VERSION)]"
	docker tag $(IMAGE_NAME):$(ENV_VERSION) $(REPOSITORY_URI):$(ENV_VERSION) | \
		tee $(OUT)/$(@)

tag-repo-latest: tag-repo
	@echo "[INFO] Tagging Docker image into registry repository as latest:" \
		"[$(IMAGE_NAME):$(ENV_VERSION)]"
	docker tag $(IMAGE_NAME):latest $(REPOSITORY_URI):latest | tee $(OUT)/$(@)

# push to ECR
push: tag-repo
	@echo "[INFO] Pushing Docker image to repository: [$(REPOSITORY_URI)]"
	eval `aws ecr get-login` && docker push $(REPOSITORY_URI):$(ENV_VERSION) | \
		tee $(OUT)/$(@)

push-latest: push tag-repo-latest
	@echo "[INFO] Pushing Docker image to repository: [$(REPOSITORY_URI)]"
	eval `aws ecr get-login` && docker push $(REPOSITORY_URI):latest | \
		tee $(OUT)/$(@)

ecr-repo-uri:
ifndef ECR_REPOSITORY_URI_PREFIX
	@echo "[INFO] Obtaining ECR repository for image: [$(IMAGE_NAME)]"
	@echo "[INFO] Obtaining ECR repository for image: [$(IMAGE_NAME)]"
	$(eval REPOSITORY_URI := $(call ecr-repo-uri))
	@if [ -z "$(REPOSITORY_URI)" ] ; then \
		echo "[ERROR] Could not find ECR repository." \
	         "Make sure to create the ECR stack." >&2 ; \
	    exit 1 ; \
	else \
		echo "[INFO] Found repository uri: [$(REPOSITORY_URI)]" ; \
	fi
else
	$(eval REPOSITORY_URI := $(addsuffix /$(IMAGE_NAME), $(ECR_REPOSITORY_URI_PREFIX)))
	echo "[INFO] Using repository uri from environmet: [$(REPOSITORY_URI)]"
endif
.PHONY: ecr-repo-uri

clean:
	-@rm -f $(OUT)/*
.PHONY: clean

distclean: clean
	$(eval REPOSITORY_URI := $(call ecr-repo-uri))
	-@docker rmi $(IMAGE_NAME):$(ENV_VERSION)
	-@docker rmi $(IMAGE_NAME)
	-@[ ! -z "$(REPOSITORY_URI)" ] && docker rmi $(REPOSITORY_URI) || :
	-@[ ! -z "$(REPOSITORY_URI)" ] && docker rmi $(REPOSITORY_URI):$(ENV_VERSION) || :
.PHONY: distclean

run: build
	@echo "[INFO] Running shell in local container using image: [$(IMAGE_NAME)]"
	docker run --rm -ti $(IMAGE_NAME):$(ENV_VERSION) bash
.PHONY: run

# get ECR repository URI from registry - needs aws cli and creds
# may want to set AWS_DEFAULT_PROFILE env var
define ecr-repo-uri
	$(shell aws ecr describe-repositories \
		--query 'repositories[?starts_with(repositoryName, `$(IMAGE_NAME)`)].repositoryUri' \
		--output text | head -1)
endef
