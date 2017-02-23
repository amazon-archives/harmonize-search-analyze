BUILD_DIR := build

build:
	@$(MAKE) -C $(BUILD_DIR) build
.PHONY: build

push-latest:
	@$(MAKE) -C $(BUILD_DIR) push-latest
.PHONY: push-latest

register-task-definition:
	@$(MAKE) -C $(BUILD_DIR) register-task-definition
.PHONY: register-task-definition

config-env:
	@$(MAKE) -C $(BUILD_DIR) config-env.json
.PHONY: config-env
