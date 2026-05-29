const fs = require('fs');
const path = require('path');
const os = require('os');
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

async function readWorkbook() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(outputPath);
  return workbook;
}

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

  const workbook = await readWorkbook();

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

test('writes integrated, award, contract, and error sheets', async () => {
  const writer = new ExcelWriter();
  await writer.init(outputPath);
  writer.addIntegratedRecord({ 검색키워드: 'ees', 입찰공고번호: 'R26', 리포트상태: '계약 확인' });
  writer.addAwardRecord({ 입찰공고번호: 'R26', 낙찰업체: '낙찰사' });
  writer.addContractRecord({ 입찰공고번호: 'R26', 계약업체: '계약사' });
  writer.addErrorLog({ 검색키워드: 'ees', 입찰공고번호: 'R26', 단계: 'API', 오류코드: '500', 오류메시지: 'fail' });
  await writer.save();

  const workbook = await readWorkbook();
  expect(workbook.getWorksheet('통합리포트').getCell('A1').value).toBe('검색키워드');
  expect(workbook.getWorksheet('통합리포트').getCell('A2').value).toBe('ees');
  expect(workbook.getWorksheet('낙찰정보').getCell('B2').value).toBe('낙찰사');
  expect(workbook.getWorksheet('계약정보').getCell('B2').value).toBe('계약사');
  expect(workbook.getWorksheet('오류로그').getCell('E2').value).toBe('fail');
});

test('deduplicates reserved sheet names within Excel length limit', async () => {
  const writer = new ExcelWriter();
  await writer.init(outputPath);
  writer.prepareSheet('통합리포트', { from: '20260101', to: '20260630' });
  writer.prepareSheet('Summary', { from: '20260101', to: '20260630' });
  writer.addIntegratedRecord({ 검색키워드: '통합리포트', 입찰공고번호: 'R26', 리포트상태: '공고만 확인' });
  writer.addAnalysisSheets({ bids: [] });
  await writer.save();

  const workbook = await readWorkbook();
  const names = workbook.worksheets.map((sheet) => sheet.name);
  expect(names).toEqual(expect.arrayContaining(['통합리포트', '통합리포트_1', 'Summary', 'Summary_1']));
  expect(names.every((name) => name.length <= 31)).toBe(true);
});
