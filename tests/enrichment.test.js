jest.mock('../contractProcess', () => ({ lookupByBidNumber: jest.fn() }));
jest.mock('../awardInfo', () => ({ lookupAwardByBidNumber: jest.fn() }));

const { lookupByBidNumber } = require('../contractProcess');
const { lookupAwardByBidNumber } = require('../awardInfo');
const { lookupEnrichmentByBidNumber } = require('../enrichment');

beforeEach(() => {
  jest.clearAllMocks();
});

test('returns contract-process result when it confirms data', async () => {
  lookupByBidNumber.mockResolvedValue({ status: '확인', items: [{ cntrctAmt: '1000' }], errors: [] });
  const result = await lookupEnrichmentByBidNumber({}, { bidNtceNo: 'R26' });
  expect(result).toMatchObject({ status: '확인', source: '계약과정통합공개' });
  expect(lookupAwardByBidNumber).not.toHaveBeenCalled();
});

test('falls back to award service when contract-process has no data', async () => {
  lookupByBidNumber.mockResolvedValue({ status: '정보 없음', items: [], errors: [] });
  lookupAwardByBidNumber.mockResolvedValue({ status: '확인', items: [{ sucsfbidAmt: '900' }], errors: [] });
  const result = await lookupEnrichmentByBidNumber({}, { bidNtceNo: 'R26' });
  expect(result).toMatchObject({ status: '확인', source: '낙찰정보' });
});

test('keeps errors from both services when fallback also fails', async () => {
  lookupByBidNumber.mockResolvedValue({
    status: 'API 조회 실패',
    items: [],
    errors: [{ stage: '계약', code: '500', message: 'fail' }],
  });
  lookupAwardByBidNumber.mockResolvedValue({
    status: 'API 조회 실패',
    items: [],
    errors: [{ stage: '낙찰', code: '500', message: 'fail' }],
  });
  const result = await lookupEnrichmentByBidNumber({}, { bidNtceNo: 'R26' });
  expect(result.status).toBe('API 조회 실패');
  expect(result.errors).toHaveLength(2);
});
