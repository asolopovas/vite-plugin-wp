SHELL := /bin/bash

.PHONY: help install build dev test test-unit typecheck lint format format-check quality check clean \
        release release-patch release-minor release-major \
        bump tag publish gh-release deploy

PKG_VERSION := $(shell node -p "require('./package.json').version")
TAG := v$(PKG_VERSION)
RELEASE_NOTES_FILE := .release-notes.md

help:
	@echo "Targets:"
	@echo "  install           bun install"
	@echo "  build             bun run build"
	@echo "  dev               bun run dev (tsup --watch)"
	@echo "  test              unit + e2e (everything)"
	@echo "  test-unit         unit only"
	@echo "  typecheck         tsc --noEmit"
	@echo "  lint              oxlint"
	@echo "  format            oxfmt --write"
	@echo "  format-check      oxfmt --check"
	@echo "  quality           format-check + lint + typecheck + build + unit tests"
	@echo "  check             quality release gate"
	@echo "  clean             remove dist/"
	@echo ""
	@echo "Release (runs check, git tag, npm publish, gh release):"
	@echo "  release           publish the CURRENT package.json version as-is"
	@echo "  release-patch     bump patch, commit, then release"
	@echo "  release-minor     bump minor, commit, then release"
	@echo "  release-major     bump major, commit, then release"
	@echo "  (idempotent — safe to re-run; OTP=<code> for npm 2FA)"
	@echo "  (notes: NOTES_FILE=path or NOTES=\"...\"; default --generate-notes)"
	@echo ""
	@echo "Low-level:"
	@echo "  bump LEVEL=patch  bump version in package.json (no tag, no commit)"
	@echo "  tag               create + push v\$$(version) git tag"
	@echo "  publish           npm publish the CURRENT version"
	@echo "  gh-release        gh release create v\$$(version) --generate-notes"
	@echo ""
	@echo "Current version: $(PKG_VERSION)"

install:
	bun install

build:
	bun run build

dev:
	bun run dev

test:
	bun run test
	bun run test:e2e

test-unit:
	bun run test

typecheck:
	bun run typecheck

lint:
	bun run lint

format:
	bun run format

format-check:
	bun run format:check

quality:
	bun run quality

check:
	bun run check

clean:
	rm -rf dist

bump:
	@test -n "$(LEVEL)" || { echo "Usage: make bump LEVEL=patch|minor|major"; exit 1; }
	npm version $(LEVEL) --no-git-tag-version
	@echo "Bumped to `node -p 'require(process.argv[1]).version' ./package.json`"

tag:
	@if git rev-parse "$(TAG)" >/dev/null 2>&1; then \
		echo "Tag $(TAG) already exists locally; skipping"; \
	else \
		git tag -a "$(TAG)" -m "Release $(TAG)"; \
	fi
	@if git ls-remote --exit-code --tags origin "$(TAG)" >/dev/null 2>&1; then \
		echo "Tag $(TAG) already on origin; skipping push"; \
	else \
		git push origin "$(TAG)"; \
	fi

publish:
	@if npm view "@asolopovas/vite-plugin-wp@$(PKG_VERSION)" version >/dev/null 2>&1; then \
		echo "$(PKG_VERSION) already published to npm; skipping"; \
	else \
		if [ -n "$(OTP)" ]; then npm publish --otp="$(OTP)"; else npm publish; fi; \
	fi

gh-release:
	@if gh release view "$(TAG)" >/dev/null 2>&1; then \
		echo "GitHub release $(TAG) already exists; skipping"; \
	else \
		highest=`git tag --list 'v*' | sort -V | tail -n1`; \
		if [ "$$highest" = "$(TAG)" ]; then latest_flag="--latest"; else latest_flag="--latest=false"; fi; \
		notes_file="$(NOTES_FILE)"; created=""; \
		if [ -z "$$notes_file" ] && [ -n "$(NOTES)" ]; then \
			notes_file="$(RELEASE_NOTES_FILE)"; created="$$notes_file"; \
			printf '%s\n' "$(NOTES)" > "$$notes_file"; \
		fi; \
		if [ -n "$$notes_file" ]; then \
			gh release create "$(TAG)" --title "$(TAG)" --notes-file "$$notes_file" $$latest_flag; \
		else \
			gh release create "$(TAG)" --title "$(TAG)" --generate-notes $$latest_flag; \
		fi; \
		[ -n "$$created" ] && rm -f "$$created" || true; \
	fi

release: check
	@git diff --quiet -- package.json || (echo "package.json has uncommitted changes; commit first"; exit 1)
	$(MAKE) tag
	$(MAKE) publish OTP="$(OTP)"
	$(MAKE) gh-release
	@echo "Released $(TAG)"

release-patch release-minor release-major: release-%:
	$(MAKE) bump LEVEL=$*
	git add package.json
	git commit -m "chore: release v`node -p 'require(process.argv[1]).version' ./package.json`"
	git push origin main
	$(MAKE) release
