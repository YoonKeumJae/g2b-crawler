const fs = require('fs');
const path = require('path');
const os = require('os');
const ExcelJS = require('exceljs');
const { ExcelWriter } = require('../writer');

let tmpDir;
let tmpFile;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'g2b-writer-'));
  tmpFile = path.join(tmpDir, 'results.xlsx');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function readWorkbook() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(tmpFile);
  return workbook;
}

test('writes keyword sheet using template date, headers, and data rows', async () => {
  const writer = new ExcelWriter();
  await writer.init(tmpFile);
  writer.addRecord('ees', { from: '20260101', to: '20260630' }, {
    입찰공고번호: 'R26BK01514945 - 000',
    공고명: '테스트 공고',
    공고기관: '조달청',
  });
  await writer.save();

  const workbook = await readWorkbook();
  const sheet = workbook.getWorksheet('ees');
  expect(sheet).toBeDefined();
  expect(sheet.getCell('B1').value).toBe('2026/01/01 ~ 2026/06/30');
  expect(sheet.getCell('C3').value).toBe('입찰공고번호');
  expect(sheet.getCell('C4').value).toBe('R26BK01514945 - 000');
  expect(sheet.getCell('E4').value).toBe('테스트 공고');
  expect(sheet.getCell('AY4').value).toBe('조달청');
});

test('writes integrated, award, contract, and error sheets', async () => {
  const writer = new ExcelWriter();
  await writer.init(tmpFile);
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

test('deduplicates long keyword sheet names within Excel length limit', async () => {
  const writer = new ExcelWriter();
  await writer.init(tmpFile);
  const longA = 'abcdefghijklmnopqrstuvwxyz0123456789-a';
  const longB = 'abcdefghijklmnopqrstuvwxyz0123456789-b';
  writer.prepareSheet(longA, { from: '20260101', to: '20260630' });
  writer.prepareSheet(longB, { from: '20260101', to: '20260630' });
  await writer.save();

  const workbook = await readWorkbook();
  const names = workbook.worksheets.map((sheet) => sheet.name);
  expect(names).toHaveLength(2);
  expect(new Set(names).size).toBe(2);
  expect(names.every((name) => name.length <= 31)).toBe(true);
});

test('reserves fixed report sheet names before keyword sheets are created', async () => {
  const writer = new ExcelWriter();
  await writer.init(tmpFile);
  writer.addRecord('통합리포트', { from: '20260101', to: '20260630' }, {
    입찰공고번호: 'R26BK01514945 - 000',
  });
  writer.addIntegratedRecord({ 검색키워드: '통합리포트', 입찰공고번호: 'R26', 리포트상태: '공고만 확인' });
  await writer.save();

  const workbook = await readWorkbook();
  expect(workbook.getWorksheet('통합리포트')).toBeDefined();
  expect(workbook.getWorksheet('통합리포트_1')).toBeDefined();
  expect(workbook.getWorksheet('통합리포트').getCell('A1').value).toBe('검색키워드');
  expect(workbook.getWorksheet('통합리포트_1').getCell('C4').value).toBe('R26BK01514945 - 000');
});
