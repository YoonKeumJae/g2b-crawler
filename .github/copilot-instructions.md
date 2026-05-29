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
- **attachment.js**: Extracts, classifies, and downloads RFP/spec/SOW attachments
- **award.js**: Looks up successful bid data through the data.go.kr G2B open API
- **resultStore.js**: Saves structured crawl output to JSON for resumable analysis
- **writer.js**: Excel report writer; creates keyword detail sheets plus Summary, Attachments, and Awards

## Key Conventions

<!-- Document project-specific patterns here once they emerge. Examples:
  - How errors are handled and propagated
  - How rate limiting / politeness delays are implemented
  - robots.txt compliance approach
  - Retry and back-off strategy
  - How crawl state is persisted/resumed
-->

## Configuration

- `keywords`: 공고명 검색 키워드 배열
- `outputPath`: Excel 리포트 경로
- `jsonOutputPath`: 구조화 JSON 원본 경로
- `attachmentDir`: 첨부파일 다운로드 디렉터리
- `DATA_GO_KR_API_KEY`: 낙찰정보 조회용 공공데이터포털 API 키
