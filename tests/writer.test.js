const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const { ExcelWriter } = require('../writer');

let tmpDir;
let outputPath;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crawler-writer-'));
  outputPath = path.join(tmpDir, 'results.xlsx');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('writes keyword detail sheet and analysis sheets to xlsx', async () => {
  const writer = new ExcelWriter();
  await writer.init(outputPath);

  writer.prepareSheet('ees', { from: '20260101', to: '20260601' });
  writer.addRecord('ees', { from: '20260101', to: '20260601' }, {
    입찰공고번호: 'R26BK00000001',
    공고명: '테스트 공고',
    공고기관: '테스트 기관',
  });
  writer.addAnalysisSheets({
    bids: [
      {
        keyword: 'ees',
        bidNumber: 'R26BK00000001',
        title: '테스트 공고',
        detailFields: { 공고기관: '테스트 기관' },
        attachments: [{ fileName: '제안요청서.pdf', kind: 'RFP', localPath: '/tmp/제안요청서.pdf' }],
        award: { status: '개찰완료', classification: 'awarded', winnerName: '낙찰 주식회사', awardAmount: '1000000' },
      },
      {
        keyword: 'ees',
        bidNumber: 'R26BK00000002',
        title: '두번째 공고',
        detailFields: {},
        attachments: [],
        award: { status: '낙찰', classification: 'awarded', winnerName: '낙찰 주식회사', awardAmount: '2000000' },
      },
    ],
  });
  await writer.save();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(outputPath);

  expect(workbook.getWorksheet('ees')).toBeTruthy();
  expect(workbook.getWorksheet('Summary').getCell('B2').value).toBe('R26BK00000001');
  expect(workbook.getWorksheet('Attachments').getCell('C2').value).toBe('제안요청서.pdf');
  expect(workbook.getWorksheet('Awards').getCell('D2').value).toBe('awarded');
  expect(workbook.getWorksheet('Awards').getCell('E2').value).toBe('낙찰 주식회사');
  expect(workbook.getWorksheet('Vendor Summary')).toBeTruthy();
  expect(workbook.getWorksheet('Vendor Summary').getCell('A2').value).toBe('낙찰 주식회사');
  expect(workbook.getWorksheet('Vendor Summary').getCell('B2').value).toBe(2);
  expect(workbook.getWorksheet('Vendor Summary').getCell('C2').value).toBe(3000000);
});
