SHELL := /bin/bash

.PHONY: help install build dev test test-unit typecheck lint format format-check quality check clean \
        release release-patch release-minor release-major _release patch minor major \
        bump tag publish commit-release gh-release deploy

PKG_VERSION := $(shell node -p "require('./package.json').version")
TAG := v$(PKG_VERSION)
RELEASE_NOTES_FILE := .release-notes.md
# Bump level passed as a bare goal, e.g. `make release patch`.
LEVEL_GOAL := $(filter patch minor major,$(MAKECMDGOALS))

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
	@echo "Release (check, npm publish, THEN commit/push/tag/gh release):"
	@echo "  release             publish the CURRENT package.json version as-is"
	@echo "  release patch       bump patch, then release (commit only after publish)"
	@echo "  release minor       bump minor, then release (commit only after publish)"
	@echo "  release major       bump major, then release (commit only after publish)"
	@echo "  (dash form also works: release-patch / release-minor / release-major)"
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

commit-release:
	@if git diff --quiet -- package.json; then \
		echo "package.json unchanged; nothing to commit"; \
	else \
		git add package.json; \
		git commit -m "chore: release $(TAG)"; \
		git push origin main; \
	fi

# Publish is the gate: check runs, then npm publish must succeed BEFORE anything
# is committed, pushed, or tagged. A failed publish leaves git untouched.
_release: check
	$(MAKE) publish OTP="$(OTP)"
	$(MAKE) commit-release
	$(MAKE) tag
	$(MAKE) gh-release
	@echo "Released $(TAG)"

# `make release`              -> publish CURRENT version as-is.
# `make release patch|minor|major` -> bump first, then release (space form).
release:
	@if [ -n "$(LEVEL_GOAL)" ]; then \
		$(MAKE) bump LEVEL=$(LEVEL_GOAL) && $(MAKE) _release; \
	else \
		$(MAKE) _release; \
	fi

# Dash form: `make release-patch` etc.
release-patch release-minor release-major: release-%:
	$(MAKE) bump LEVEL=$*
	$(MAKE) _release

# Bare level words are consumed by `release` above; no-op on their own so
# `make release patch` doesn't error on the second goal.
patch minor major:
	@:
