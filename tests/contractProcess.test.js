const { lookupByBidNumber } = require('../contractProcess');
const { CONTRACT_PROCESS_ENDPOINTS } = require('../contractProcess');

function ok(items) {
  return { ok: true, items };
}

test('uses first endpoint with items', async () => {
  const client = { getJson: jest.fn().mockResolvedValueOnce(ok([{ bidNtceNo: 'R26' }])) };
  const result = await lookupByBidNumber(client, { bidNtceNo: 'R26', bidNtceOrd: '000' });
  expect(result.status).toBe('확인');
  expect(result.items).toEqual([{ bidNtceNo: 'R26' }]);
  expect(client.getJson).toHaveBeenCalledTimes(1);
});

test('continues until a later endpoint returns items', async () => {
  const client = { getJson: jest.fn().mockResolvedValueOnce(ok([])).mockResolvedValueOnce(ok([{ bidNtceNo: 'R26' }])) };
  const result = await lookupByBidNumber(client, { bidNtceNo: 'R26', bidNtceOrd: '000' });
  expect(result.status).toBe('확인');
  expect(client.getJson).toHaveBeenCalledTimes(2);
});

test('returns no information when every endpoint has no items', async () => {
  const client = { getJson: jest.fn().mockResolvedValue(ok([])) };
  const result = await lookupByBidNumber(client, { bidNtceNo: 'R26', bidNtceOrd: '000' });
  expect(result).toMatchObject({ status: '정보 없음', items: [] });
  expect(client.getJson).toHaveBeenCalledTimes(4);
});

test('logs endpoint errors and continues to success', async () => {
  const client = { getJson: jest.fn().mockResolvedValueOnce({ ok: false, code: '500', message: 'fail' }).mockResolvedValueOnce(ok([{ bidNtceNo: 'R26' }])) };
  const result = await lookupByBidNumber(client, { bidNtceNo: 'R26', bidNtceOrd: '000' });
  expect(result.status).toBe('확인');
  expect(result.errors).toHaveLength(1);
});

test('returns api failure when every endpoint errors', async () => {
  const client = { getJson: jest.fn().mockResolvedValue({ ok: false, code: '500', message: 'fail' }) };
  const result = await lookupByBidNumber(client, { bidNtceNo: 'R26', bidNtceOrd: '000' });
  expect(result.status).toBe('API 조회 실패');
  expect(result.errors).toHaveLength(4);
});

test('returns api failure when any endpoint errors and no endpoint has items', async () => {
  const client = {
    getJson: jest.fn()
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce({ ok: false, stage: '계약과정통합공개:용역', code: '500', message: 'fail' })
      .mockResolvedValue(ok([])),
  };
  const result = await lookupByBidNumber(client, { bidNtceNo: 'R26', bidNtceOrd: '000' });
  expect(result.status).toBe('API 조회 실패');
  expect(result.errors).toHaveLength(1);
});

test('uses https endpoints so service keys are not sent over plain http', () => {
  expect(CONTRACT_PROCESS_ENDPOINTS.every((endpoint) => endpoint.url.startsWith('https://'))).toBe(true);
});
