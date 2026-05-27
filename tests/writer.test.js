const fs = require('fs');
const path = require('path');
const os = require('os');
const { write, reset } = require('../writer');

let tmpFile;

beforeEach(() => {
  tmpFile = path.join(os.tmpdir(), `test-${Date.now()}.csv`);
  reset();
});

afterEach(() => {
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
});

test('creates CSV with header on first write', () => {
  write(tmpFile, { 공고번호: 'A001', 공고명: '테스트' });
  const lines = fs.readFileSync(tmpFile, 'utf8').trim().split('\n');
  expect(lines[0]).toBe('공고번호,공고명');
  expect(lines[1]).toBe('"A001","테스트"');
});

test('appends rows without rewriting header', () => {
  write(tmpFile, { 공고번호: 'A001', 공고명: '첫번째' });
  write(tmpFile, { 공고번호: 'A002', 공고명: '두번째' });
  const lines = fs.readFileSync(tmpFile, 'utf8').trim().split('\n');
  expect(lines).toHaveLength(3);
  expect(lines[2]).toBe('"A002","두번째"');
});

test('creates output directory if it does not exist', () => {
  const nestedPath = path.join(os.tmpdir(), `nested-${Date.now()}`, 'out.csv');
  write(nestedPath, { 공고번호: 'X001' });
  expect(fs.existsSync(nestedPath)).toBe(true);
  fs.unlinkSync(nestedPath);
  fs.rmdirSync(path.dirname(nestedPath));
});

test('escapes double quotes in values', () => {
  write(tmpFile, { 공고명: 'say "hello"' });
  const lines = fs.readFileSync(tmpFile, 'utf8').trim().split('\n');
  expect(lines[1]).toBe('"say ""hello"""');
});
