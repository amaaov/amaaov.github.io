# Holding Topology FM-1 — top-level maintainer targets
#
# Native macOS stage (no WebView):
#   make run          build latest and launch
#   make build        xcodegen + xcodebuild only
#   make open         open Xcode project
#   make clean-native remove DerivedData / generated project

MACOS_DIR := macos
PROJECT := $(MACOS_DIR)/HoldingTopologyStage.xcodeproj
SCHEME := HoldingTopologyStage
CONFIG ?= Debug
DERIVED := $(MACOS_DIR)/DerivedData
APP := $(DERIVED)/Build/Products/$(CONFIG)/HoldingTopologyStage.app
BIN := $(APP)/Contents/MacOS/HoldingTopologyStage

.PHONY: help build run open clean-native test project

help:
	@echo "Targets:"
	@echo "  make run          build native stage and launch"
	@echo "  make build        build native stage only"
	@echo "  make open         open HoldingTopologyStage.xcodeproj"
	@echo "  make clean-native wipe macos DerivedData and .xcodeproj"
	@echo "  make test         JS + firmware tests"

project: $(PROJECT)

$(PROJECT): $(MACOS_DIR)/project.yml
	cd $(MACOS_DIR) && xcodegen generate

# Always ask xcodebuild; it is incremental when sources are unchanged.
build: project
	cd $(MACOS_DIR) && xcodebuild \
		-project HoldingTopologyStage.xcodeproj \
		-scheme $(SCHEME) \
		-configuration $(CONFIG) \
		-derivedDataPath DerivedData \
		build
	@test -x "$(BIN)" || (echo "missing binary: $(BIN)" >&2; exit 1)

run: build
	@pkill -x HoldingTopologyStage >/dev/null 2>&1 || true
	@"$(BIN)"

open: $(PROJECT)
	open $(PROJECT)

clean-native:
	rm -rf $(DERIVED) $(PROJECT)

test:
	npm test
