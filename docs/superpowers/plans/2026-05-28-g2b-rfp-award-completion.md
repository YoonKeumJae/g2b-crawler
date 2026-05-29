# G2B RFP and Award Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the crawler so it reliably links historical G2B bid notices to downloaded RFP/attachment files, successful bidder data across procurement categories, and analysis-ready JSON/XLSX outputs.

**Architecture:** Keep the existing Node.js CommonJS pipeline. Add focused modules around Playwright diagnostics, attachment extraction/download, award endpoint fallback, and result enrichment. `results.json` remains the structured source of truth; `results.xlsx` remains the human-facing report.

**Tech Stack:** Node.js 18+ CommonJS, Playwright Chromium, ExcelJS, Jest, G2B WebSquare UI, data.go.kr `ScsbidInfoService`.

---

## Current State

Working:
- G2B search by keyword and date range.
- Detail page extraction into JSON/XLSX.
- Successful-bid lookup through `ScsbidInfoService/getScsbidListSttusThng` with `inqryDiv=4`.
- Winner mapping for `bidwinnrNm`, `bidwinnrBizno`, `sucsfbidAmt`, `sucsfbidRate`, and `rlOpengDt`.
- Latest full run produced 20 bids, 14 successful-bid matches, and 6 `not_found` records.

Not yet complete:
- RFP/attachment download currently returns 0 files.
- Award lookup only uses the goods endpoint.
- `not_found` is not classified into not awarded yet, failed bid, rebid, category mismatch, or no API data.
- Excel is useful but not yet strong enough for vendor/category analysis.

## File Map

| File | Role |
|------|------|
| `attachment.js` | Extract, classify, and download G2B attachments. Needs WebSquare action support. |
| `tests/attachment.test.js` | Unit tests for attachment classification and DOM/action parsing. |
| `attachmentProbe.js` | New manual diagnostic script to inspect one bid detail page and record attachment-related DOM/events. |
| `award.js` | Successful-bid API lookup and normalization. Needs category endpoint fallback and result classification. |
| `tests/award.test.js` | Unit tests for endpoint selection, normalization, and API error handling. |
| `resultStore.js` | JSON store. Needs optional enrichment helpers for status summaries. |
| `writer.js` | XLSX report writer. Needs more analysis sheets and numeric amount formatting. |
| `tests/writer.test.js` | Excel output tests for new sheets/columns. |
| `crawler.js` | Orchestrates search, detail, attachment, award, JSON save, XLSX export. Needs clearer progress output. |
| `README.md` | Document execution, API approval, outputs, and known limitations. |

---

## Task 1: Build an Attachment Diagnostic Probe

**Files:**
- Create: `attachmentProbe.js`
- Modify: `package.json`

- [ ] **Step 1: Create a probe script that opens one known bid and prints attachment-related elements**

Create `attachmentProbe.js`:

```js
const { chromium } = require('playwright');
const config = require('./config');
const { search } = require('./search');

const keyword = process.argv[2] || 'ees';
const rowIndex = Number(process.argv[3] || 0);

(async () => {
  const browser = await chromium.launch({
    headless: config.headless,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });
  const page = await context.newPage();

  try {
    await search(page, keyword, config.getDateRange());
    await page.click(`#mf_wfm_container_grdTotalSrch_${rowIndex}_untyTitleTd`, { force: true });
    await page.waitForTimeout(3000);

    const candidates = await page.evaluate(() => {
      const pattern = /첨부|파일|공고서|규격|제안|과업|다운|download|file|atch|hwp|pdf|docx|xlsx/i;
      return Array.from(document.querySelectorAll('a, button, input, img, span, div'))
        .map((el) => ({
          tag: el.tagName,
          id: el.id || '',
          className: String(el.className || ''),
          text: (el.innerText || el.value || el.alt || el.title || '').trim().slice(0, 200),
          href: el.getAttribute('href') || '',
          onclick: el.getAttribute('onclick') || '',
          dataset: { ...el.dataset },
        }))
        .filter((item) => pattern.test(Object.values(item).join(' ')))
        .slice(0, 200);
    });

    console.log(JSON.stringify(candidates, null, 2));
  } finally {
    await browser.close();
  }
})();
```

- [ ] **Step 2: Add a package script**

Modify `package.json` scripts:

```json
"scripts": {
  "start": "node crawler.js",
  "test": "jest",
  "probe:attachments": "node attachmentProbe.js"
}
```

- [ ] **Step 3: Run the probe outside the sandbox**

Run:

```bash
npm run probe:attachments -- ees 0
```

Expected: JSON output containing attachment-related IDs/classes/buttons. Save notable selectors in the task notes before moving to Task 2.

- [ ] **Step 4: Commit**

```bash
git add attachmentProbe.js package.json package-lock.json
git commit -m "chore: add attachment diagnostic probe"
```

---

## Task 2: Parse WebSquare Attachment Actions

**Files:**
- Modify: `attachment.js`
- Modify: `tests/attachment.test.js`

- [ ] **Step 1: Add failing tests for script-based attachment actions**

Add to `tests/attachment.test.js`:

```js
test('extracts attachment metadata from WebSquare action attributes', () => {
  const html = `
    <button id="mf_wfm_container_bidPbancWfrm_fileGrid_0_downBtn"
      onclick="mf_wfm_container_bidPbancWfrm.downloadFile('R26BK01514945','000','1')">
      제안요청서.pdf
    </button>
    <span id="mf_wfm_container_bidPbancWfrm_fileGrid_1_fileNm">규격서.hwp</span>
    <button onclick="downloadFile('R26BK01514945','000','2')">다운로드</button>
  `;

  expect(extractAttachmentsFromDom(html, {
    bidNumber: 'R26BK01514945',
    baseUrl: 'https://www.g2b.go.kr/',
  })).toEqual([
    expect.objectContaining({
      bidNumber: 'R26BK01514945',
      fileName: '제안요청서.pdf',
      kind: 'RFP',
    }),
    expect.objectContaining({
      bidNumber: 'R26BK01514945',
      fileName: '규격서.hwp',
      kind: 'SPEC',
    }),
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx jest tests/attachment.test.js --runInBand
```

Expected: FAIL because current extraction only handles simple anchors and narrow onclick URLs.

- [ ] **Step 3: Implement action parsing**

Update `attachment.js` with helper functions:

```js
function extractDownloadArgs(onclick) {
  const match = String(onclick || '').match(/downloadFile\s*\(([^)]*)\)/i);
  if (!match) return null;
  return match[1]
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ''));
}

function buildG2bDownloadUrl({ bidNumber, bidOrder, fileSeq, baseUrl }) {
  const url = new URL('/pn/pnp/pnpe/UntyAtchFile/downloadFile.do', baseUrl || 'https://www.g2b.go.kr/');
  url.searchParams.set('bidPbancNo', bidNumber);
  if (bidOrder) url.searchParams.set('bidPbancOrd', bidOrder);
  if (fileSeq) url.searchParams.set('fileSeq', fileSeq);
  return url.toString();
}
```

Use these helpers inside `extractAttachmentsFromDom()` when an element has `onclick` but no direct URL.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx jest tests/attachment.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add attachment.js tests/attachment.test.js
git commit -m "feat: parse G2B attachment download actions"
```

---

## Task 3: Download Attachments Through the Browser Session

**Files:**
- Modify: `attachment.js`
- Modify: `tests/attachment.test.js`

- [ ] **Step 1: Add failing test for download result shape**

Add to `tests/attachment.test.js`:

```js
test('downloadAttachments records HTTP failures without throwing', async () => {
  const page = {
    context: () => ({
      request: {
        get: async () => ({
          ok: () => false,
          status: () => 403,
        }),
      },
    }),
  };

  const results = await downloadAttachments(page, [{
    bidNumber: 'R26BK01514945',
    fileName: '제안요청서.pdf',
    kind: 'RFP',
    downloadUrl: 'https://www.g2b.go.kr/file',
  }], '/tmp/crawler-attachments-test');

  expect(results).toEqual([
    expect.objectContaining({
      fileName: '제안요청서.pdf',
      downloadStatus: 'HTTP 403',
      localPath: null,
    }),
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails or exposes current behavior**

Run:

```bash
npx jest tests/attachment.test.js --runInBand
```

Expected: FAIL if `downloadAttachments` is not imported or does not record status as expected.

- [ ] **Step 3: Export and harden `downloadAttachments`**

Ensure `attachment.js` exports:

```js
module.exports = {
  classifyAttachment,
  extractAttachmentsFromDom,
  extractAttachments,
  downloadAttachments,
};
```

Ensure each download result includes:

```js
{
  ...attachment,
  localPath,
  downloadStatus: 'downloaded'
}
```

or:

```js
{
  ...attachment,
  localPath: null,
  downloadStatus: 'HTTP 403'
}
```

- [ ] **Step 4: Run attachment tests**

Run:

```bash
npx jest tests/attachment.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 5: Run a small real crawl and inspect `output/attachments`**

Run:

```bash
npm start
find output/attachments -maxdepth 3 -type f | head
```

Expected: At least some files for bids whose detail pages expose downloadable attachments. If still 0 files, return to Task 1 and update the parser based on the probe output.

- [ ] **Step 6: Commit**

```bash
git add attachment.js tests/attachment.test.js output/results.json output/results.xlsx
git commit -m "feat: download G2B bid attachments"
```

---

## Task 4: Add Award Endpoint Fallback by Procurement Category

**Files:**
- Modify: `award.js`
- Modify: `tests/award.test.js`

- [ ] **Step 1: Add failing test for endpoint fallback**

Add to `tests/award.test.js`:

```js
test('lookupAwardViaOpenApi tries service endpoint when goods endpoint has no match', async () => {
  const called = [];
  const fetchImpl = jest.fn(async (url) => {
    called.push(url.pathname.split('/').pop());
    const endpoint = url.pathname.split('/').pop();
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          response: {
            header: { resultCode: '00' },
            body: {
              items: endpoint === 'getScsbidListSttusServc'
                ? [{ bidNtceNo: 'R26BK00000001', bidwinnrNm: '서비스 낙찰사' }]
                : [],
            },
          },
        });
      },
    };
  });

  const result = await lookupAwardViaOpenApi({
    apiKey: 'test-key',
    bidNumber: 'R26BK00000001',
    businessType: '용역',
    fetchImpl,
  });

  expect(result.winnerName).toBe('서비스 낙찰사');
  expect(called).toContain('getScsbidListSttusServc');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx jest tests/award.test.js --runInBand
```

Expected: FAIL because `award.js` currently calls only `getScsbidListSttusThng`.

- [ ] **Step 3: Implement endpoint selection**

Add to `award.js`:

```js
const AWARD_ENDPOINTS = {
  물품: 'getScsbidListSttusThng',
  공사: 'getScsbidListSttusCnstwk',
  용역: 'getScsbidListSttusServc',
  외자: 'getScsbidListSttusFrgcpt',
};

function endpointOrderForBusinessType(businessType) {
  const primary = AWARD_ENDPOINTS[businessType] || AWARD_ENDPOINTS.물품;
  return [primary, ...Object.values(AWARD_ENDPOINTS).filter((endpoint) => endpoint !== primary)];
}
```

Use `endpointOrderForBusinessType(inferBusinessType(record))` inside `lookupAwardViaOpenApi()`.

- [ ] **Step 4: Run award tests**

Run:

```bash
npx jest tests/award.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 5: Run full tests**

Run:

```bash
npm test -- --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add award.js tests/award.test.js
git commit -m "feat: add award endpoint fallback"
```

---

## Task 5: Classify `not_found` Award Results

**Files:**
- Modify: `award.js`
- Modify: `tests/award.test.js`
- Modify: `writer.js`

- [ ] **Step 1: Add failing test for not-found classification**

Add to `tests/award.test.js`:

```js
test('classifies not found awards with a stable reason', () => {
  expect(classifyAwardStatus({
    award: { status: 'not_found' },
    detailFields: { 공고종류: '실공고(등록공고)', 개찰일시: '2026/07/01 11:00:00' },
    now: new Date('2026-05-28T00:00:00+09:00'),
  })).toBe('not_opened_yet');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx jest tests/award.test.js --runInBand
```

Expected: FAIL because `classifyAwardStatus` does not exist.

- [ ] **Step 3: Implement `classifyAwardStatus`**

Add to `award.js`:

```js
function classifyAwardStatus({ award, detailFields, now = new Date() }) {
  if (award?.winnerName) return 'awarded';
  if (award?.status === 'lookup_failed') return 'lookup_failed';

  const openingDate = inferOpeningDate(detailFields);
  if (openingDate) {
    const openedAt = new Date(`${openingDate.slice(0, 4)}-${openingDate.slice(4, 6)}-${openingDate.slice(6, 8)}T23:59:59+09:00`);
    if (openedAt > now) return 'not_opened_yet';
  }

  const text = Object.values(detailFields || {}).join(' ');
  if (/유찰/.test(text)) return 'failed_bid_possible';
  if (/재입찰/.test(text)) return 'rebid_possible';
  return 'not_found';
}
```

- [ ] **Step 4: Add the classification to Awards sheet**

In `writer.js`, add an `분류` column to the `Awards` sheet and write `award.classification || ''`.

- [ ] **Step 5: Set classification in `crawler.js`**

After award lookup:

```js
award.classification = classifyAwardStatus({ award, detailFields: record });
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add award.js crawler.js writer.js tests/award.test.js tests/writer.test.js
git commit -m "feat: classify award lookup outcomes"
```

---

## Task 6: Improve XLSX Analysis Sheets

**Files:**
- Modify: `writer.js`
- Modify: `tests/writer.test.js`

- [ ] **Step 1: Add failing test for vendor summary sheet**

Add to `tests/writer.test.js`:

```js
expect(workbook.getWorksheet('Vendor Summary')).toBeTruthy();
```

Extend the workbook test fixture with two bids won by the same vendor:

```js
{
  keyword: 'ees',
  bidNumber: 'R26BK00000002',
  title: '두번째 공고',
  detailFields: {},
  attachments: [],
  award: { status: '낙찰', winnerName: '낙찰 주식회사', awardAmount: '2000000' },
}
```

Then assert:

```js
expect(workbook.getWorksheet('Vendor Summary').getCell('A2').value).toBe('낙찰 주식회사');
expect(workbook.getWorksheet('Vendor Summary').getCell('B2').value).toBe(2);
expect(workbook.getWorksheet('Vendor Summary').getCell('C2').value).toBe(3000000);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx jest tests/writer.test.js --runInBand
```

Expected: FAIL because `Vendor Summary` does not exist.

- [ ] **Step 3: Implement vendor summary**

Add to `writer.js`:

```js
_addVendorSummarySheet(resultData) {
  const sheet = this._replaceSheet('Vendor Summary');
  const totals = new Map();

  for (const bid of resultData.bids || []) {
    const name = bid.award?.winnerName;
    if (!name) continue;
    const current = totals.get(name) || { count: 0, amount: 0 };
    current.count += 1;
    current.amount += Number(String(bid.award?.awardAmount || '0').replace(/,/g, '')) || 0;
    totals.set(name, current);
  }

  const rows = Array.from(totals.entries())
    .map(([name, value]) => [name, value.count, value.amount])
    .sort((a, b) => b[2] - a[2]);

  this._writePlainTable(sheet, ['낙찰업체', '낙찰건수', '총낙찰금액'], rows);
}
```

Call it from `addAnalysisSheets()`.

- [ ] **Step 4: Run writer test and full test suite**

Run:

```bash
npx jest tests/writer.test.js --runInBand
npm test -- --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add writer.js tests/writer.test.js
git commit -m "feat: add vendor summary report"
```

---

## Task 7: End-to-End Verification and Documentation

**Files:**
- Modify: `README.md`
- Modify: `.github/copilot-instructions.md`

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test -- --runInBand
```

Expected: all tests pass.

- [ ] **Step 2: Run full crawler**

Run outside the sandbox because Playwright Chromium needs macOS browser permissions:

```bash
npm start
```

Expected:

```text
Saved output/results.xlsx
Total: N records across 3 keyword(s).
```

- [ ] **Step 3: Summarize output quality**

Run:

```bash
node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('output/results.json','utf8')); const winners=d.bids.filter(b=>b.award?.winnerName).length; const attachments=d.bids.reduce((n,b)=>n+(b.attachments||[]).length,0); console.log({bids:d.bids.length,winners,attachments});"
```

Expected: prints bid count, winner count, and attachment count. Attachment count should be greater than 0 once Tasks 1-3 are complete.

- [ ] **Step 4: Update README**

Document:
- `DATA_GO_KR_API_KEY`
- `.env` support
- output files
- attachment directory
- award endpoint fallback behavior
- known `not_found` meanings

- [ ] **Step 5: Commit**

```bash
git add README.md .github/copilot-instructions.md output/results.json output/results.xlsx
git commit -m "docs: document completed G2B analysis workflow"
```

---

## Execution Recommendation

Execute in this order:

1. Task 1: Attachment probe.
2. Task 2: Attachment parser.
3. Task 3: Attachment downloader.
4. Task 4: Award endpoint fallback.
5. Task 5: `not_found` classification.
6. Task 6: XLSX analysis sheets.
7. Task 7: End-to-end verification and docs.

This order keeps the riskiest unknown first: G2B attachment mechanics. Award endpoint fallback and reporting are straightforward once the attachment path is understood.

## Self-Review

- Spec coverage: Covers RFP/attachments, award category fallback, `not_found` classification, XLSX analysis, and verification.
- Placeholder scan: No placeholder task remains; each task has concrete files, commands, and expected results.
- Type consistency: Uses existing `award`, `attachments`, `detailFields`, `results.json`, and `ExcelWriter` shapes already present in the project.
