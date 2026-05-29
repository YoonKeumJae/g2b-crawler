const fs = require('fs');
const os = require('os');
const path = require('path');
const { ResultStore } = require('../resultStore');

let tmpDir;
let outputPath;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crawler-store-'));
  outputPath = path.join(tmpDir, 'results.json');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('upserts bids by bid number and keyword without duplicating records', () => {
  const store = new ResultStore({
    outputPath,
    dateRange: { from: '20260101', to: '20260601' },
    keywords: ['ees'],
  });

  store.upsertBid({
    keyword: 'ees',
    bidNumber: 'R26BK00000001',
    title: 'first title',
    detailFields: { 공고명: 'first title' },
  });
  store.upsertBid({
    keyword: 'ees',
    bidNumber: 'R26BK00000001',
    title: 'updated title',
    award: { status: '낙찰', winnerName: '테스트 주식회사' },
  });

  const data = store.toJSON();
  expect(data.bids).toHaveLength(1);
  expect(data.bids[0]).toMatchObject({
    keyword: 'ees',
    bidNumber: 'R26BK00000001',
    title: 'updated title',
    detailFields: { 공고명: 'first title' },
    award: { status: '낙찰', winnerName: '테스트 주식회사' },
  });
});

test('saves and loads structured crawl results', () => {
  const store = new ResultStore({
    outputPath,
    dateRange: { from: '20260101', to: '20260601' },
    keywords: ['ees', '오피스365'],
  });
  store.upsertBid({
    keyword: '오피스365',
    bidNumber: 'R26BK00000002',
    title: 'office bid',
    attachments: [{ fileName: '제안요청서.pdf', kind: 'RFP' }],
  });

  store.save();

  const loaded = ResultStore.load(outputPath);
  expect(loaded.toJSON()).toMatchObject({
    dateRange: { from: '20260101', to: '20260601' },
    keywords: ['ees', '오피스365'],
    bids: [
      {
        keyword: '오피스365',
        bidNumber: 'R26BK00000002',
        attachments: [{ fileName: '제안요청서.pdf', kind: 'RFP' }],
      },
    ],
  });
});
