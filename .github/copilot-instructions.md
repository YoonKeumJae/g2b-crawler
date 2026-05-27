# Copilot Instructions

## Project Overview

This is a web crawler project. Update this section as the architecture takes shape.

## Build, Test & Lint

```bash
# Install dependencies
npm install
npx playwright install chromium

# Run the crawler
node crawler.js

# Run all tests
npx jest

# Run a single test file
npx jest tests/writer.test.js
```

## Architecture

- **crawler.js**: Main entry point; orchestrates the full crawl pipeline
- **config.js**: Configuration module with keyword, headless flag, outputPath, and getDateRange() utility
- **search.js**: Navigates g2b.go.kr, fills the search form with config, and submits queries
- **paginator.js**: Collects all detail URLs across paginated result pages
- **detail.js**: Extracts all th→td field pairs from a detail page into structured data
- **writer.js**: Incremental CSV writer; exports write() and reset() functions

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
