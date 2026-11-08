SHELL := /bin/sh
PNPM ?= pnpm

.DEFAULT_GOAL := help

.PHONY: help install install-ci dev build preview lint format format-check typecheck test test-unit test-arch test-coverage check verify engine engine-check ci clean

help:
	@printf '%s\n' \
		'cwplayer targets:' \
		'  make install       Install dependencies' \
		'  make install-ci    Install dependencies from the lockfile' \
		'  make dev           Start the Vite development server' \
		'  make build         Build the production PWA' \
		'  make preview       Preview the production build' \
		'  make lint          Run ESLint and Stylelint' \
		'  make format        Format sources with Prettier' \
		'  make format-check  Check formatting without writing' \
		'  make typecheck     Run TypeScript checks' \
		'  make test          Run Playwright end-to-end tests' \
		'  make test-unit     Run Vitest unit tests' \
		'  make test-arch     Run architecture tests' \
		'  make test-coverage Run unit tests with coverage' \
		'  make check         Lint, format, typecheck, architecture and coverage' \
		'  make verify        Run check and end-to-end tests' \
		'  make engine        Rebuild the pinned cwtone.wasm from ../cwtone' \
		'  make engine-check  Verify the pinned cwtone.wasm checksum' \
		'  make ci            Verify the engine hash, run checks and end-to-end tests' \
		'  make clean         Remove build, coverage and test outputs'

install:
	$(PNPM) install

install-ci:
	$(PNPM) install --frozen-lockfile

dev:
	$(PNPM) dev

build:
	$(PNPM) build

preview:
	$(PNPM) preview

lint:
	$(PNPM) lint

format:
	$(PNPM) format

format-check:
	$(PNPM) format:check

typecheck:
	$(PNPM) typecheck

test:
	$(PNPM) test

test-unit:
	$(PNPM) test:unit

test-arch:
	$(PNPM) test:arch

test-coverage:
	$(PNPM) test:coverage

check:
	$(PNPM) check

verify:
	$(PNPM) verify

engine:
	$(PNPM) build:wasm

engine-check:
	@expected=$$(cat CWTONE_SHA256); echo "$$expected  public/engine/cwtone.wasm" | sha256sum -c -

ci: engine-check verify

clean:
	rm -rf dist coverage test-results playwright-report .eslintcache .stylelintcache tsconfig.tsbuildinfo
