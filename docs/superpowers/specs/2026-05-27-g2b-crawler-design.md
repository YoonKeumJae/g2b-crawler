# G2B 입찰공고 Crawler — Design Spec

**Date:** 2026-05-27
**Target:** https://www.g2b.go.kr — 입찰공고 (Bid Announcements)

---

## Overview

A Node.js CLI script that searches 나라장터(G2B) for bid announcements matching a keyword in the 공고명 field, paginates through all results, visits each detail page, and saves all extracted fields to a CSV file.

**Run command:**
```bash
node crawler.js
```

---

## Configuration (`config.js`)

| Key | Default | Description |
|-----|---------|-------------|
| `keyword` | `"ees"` | 공고명 search keyword |
| `dateRange` | last 1 month | Start/end date computed at runtime |
| `outputPath` | `output/results.csv` | CSV output file path |
| `headless` | `true` | Run browser headlessly |

---

## Architecture

```
crawler/
├── crawler.js        ← Entry point. Orchestrates the full pipeline.
├── config.js         ← Keyword, date range, output path settings.
├── search.js         ← Navigates to search page, fills 공고명 + date, submits.
├── paginator.js      ← Iterates result pages, collects detail page URLs.
├── detail.js         ← Opens each detail page, extracts all available fields.
├── writer.js         ← Appends each row to CSV incrementally.
└── output/
    └── results.csv   ← Auto-created on first run.
```

### Pipeline Flow

```
launch browser
    └─▶ search.js  → fill 공고명="ees", date=last 1 month, submit
            └─▶ paginator.js  → collect all detail URLs across all pages
                    └─▶ detail.js  → for each URL, extract all fields
                            └─▶ writer.js  → append row to CSV
close browser
```

---

## Module Responsibilities

### `crawler.js`
- Launches Playwright Chromium browser
- Calls each module in sequence
- Closes browser on completion or error

### `search.js`
- Navigates to g2b.go.kr
- Finds the 입찰공고 search menu
- Fills in: 공고명 = keyword, 공고일 from = (today - 1 month), to = today
- Submits the search form
- Returns control to caller (on the results list page)

### `paginator.js`
- Reads total result count from the page
- Iterates through all result pages
- Collects the URL or identifier for each row's detail page
- Returns a flat array of detail page URLs

### `detail.js`
- Navigates to a detail page URL
- Extracts all visible fields (label + value pairs)
- Returns a flat key-value object per announcement

### `writer.js`
- On first call: creates `output/results.csv` and writes the header row
- On each subsequent call: appends a data row
- Writes incrementally so partial runs are not lost

---

## Data Fields

All visible fields from the 입찰공고 detail page are extracted dynamically (label → value). Expected fields include:

- 공고번호, 공고명
- 공고기관, 수요기관
- 계약방법, 입찰방식
- 공고일, 입찰마감일시, 개찰일시
- 예산금액, 기초금액
- 담당자명, 담당자 연락처
- 기타 모든 표시 항목

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Network timeout on page load | Retry up to 3 times with 3s delay |
| Detail page fails to load | Log warning, skip row, continue |
| No results found | Print message, exit cleanly |
| Output directory missing | Auto-created before first write |

---

## Tech Stack

- **Runtime:** Node.js (CommonJS)
- **Browser automation:** Playwright (Chromium)
- **CSV output:** Built-in `fs` module (no external dependency)

---

## Out of Scope

- Scheduled / recurring runs
- Database storage
- Authentication (assumes public search)
- Parallel scraping
