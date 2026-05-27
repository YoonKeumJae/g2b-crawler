# Copilot Instructions

## Project Overview

This is a web crawler project. Update this section as the architecture takes shape.

## Build, Test & Lint

<!-- Update these commands once a package manager and toolchain are chosen -->

```bash
# Install dependencies
# npm install  /  pip install -r requirements.txt  /  go mod tidy

# Run all tests
# npm test  /  pytest  /  go test ./...

# Run a single test
# npm test -- --testPathPattern=<name>  /  pytest tests/test_file.py::test_name  /  go test ./... -run TestName

# Lint
# npm run lint  /  ruff check .  /  golangci-lint run
```

## Architecture

<!-- Fill in once files exist. Key things to document here:
  - Entry point (e.g., main.py, cmd/crawler/main.go, src/index.ts)
  - Crawl pipeline stages (fetch → parse → store → queue)
  - Concurrency model (goroutines, asyncio, worker threads)
  - Storage backend (database, file system, queue)
  - How frontier/URL queue is managed
-->

## Key Conventions

<!-- Document project-specific patterns here once they emerge. Examples:
  - How errors are handled and propagated
  - How rate limiting / politeness delays are implemented
  - robots.txt compliance approach
  - Retry and back-off strategy
  - How crawl state is persisted/resumed
-->

## Configuration

<!-- Document config file format and key settings once established -->
