const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadEnvFile } = require('../envLoader');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'g2b-env-'));
});

afterEach(() => {
  delete process.env.DATA_GO_KR_SERVICE_KEY;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('loads key value pairs from env file without overriding existing env', () => {
  const envPath = path.join(tmpDir, '.env');
  fs.writeFileSync(envPath, [
    '# local secrets',
    'DATA_GO_KR_SERVICE_KEY=from-file',
    'OTHER_VALUE="quoted value"',
    '',
  ].join('\n'));

  process.env.DATA_GO_KR_SERVICE_KEY = 'from-shell';
  loadEnvFile(envPath);

  expect(process.env.DATA_GO_KR_SERVICE_KEY).toBe('from-shell');
  expect(process.env.OTHER_VALUE).toBe('quoted value');
});

test('ignores missing env file', () => {
  expect(() => loadEnvFile(path.join(tmpDir, '.env'))).not.toThrow();
});
