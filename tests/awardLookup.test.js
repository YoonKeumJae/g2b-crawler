const { lookupAwardForResultStore } = require('../awardLookup');

test('returns not_found instead of throwing when bid number is missing', async () => {
  const lookup = jest.fn();
  const award = await lookupAwardForResultStore({
    apiKey: 'key',
    bidNumber: '',
    record: {},
    lookup,
  });
  expect(award).toMatchObject({
    source: 'data.go.kr',
    status: 'not_found',
    classification: 'not_found',
    error: 'bidNumber is missing',
  });
  expect(lookup).not.toHaveBeenCalled();
});

test('returns not_configured without lookup when api is disabled', async () => {
  const lookup = jest.fn();
  const award = await lookupAwardForResultStore({
    apiEnabled: false,
    apiKey: 'key',
    bidNumber: 'R26BK00000001',
    record: {},
    lookup,
  });
  expect(award).toMatchObject({
    source: 'data.go.kr',
    status: 'not_configured',
    classification: 'not_configured',
    error: 'API enrichment is disabled',
  });
  expect(lookup).not.toHaveBeenCalled();
});

test('converts lookup rejection into lookup_failed award object', async () => {
  const lookup = jest.fn().mockRejectedValue(new Error('network down'));
  const award = await lookupAwardForResultStore({
    apiKey: 'key',
    bidNumber: 'R26BK00000001',
    record: {},
    lookup,
  });
  expect(award).toMatchObject({
    source: 'data.go.kr',
    status: 'lookup_failed',
    classification: 'lookup_failed',
    error: 'network down',
  });
});

test('delegates to legacy award lookup and classifies the result', async () => {
  const lookup = jest.fn().mockResolvedValue({ source: 'data.go.kr', status: '낙찰', winnerName: '낙찰사' });
  const award = await lookupAwardForResultStore({
    apiKey: 'key',
    bidNumber: 'R26BK00000001',
    record: { 공고명: '물품 공고' },
    lookup,
  });
  expect(award.classification).toBe('awarded');
  expect(lookup).toHaveBeenCalledWith(expect.objectContaining({
    apiKey: 'key',
    bidNumber: 'R26BK00000001',
    businessType: '물품',
  }));
});
