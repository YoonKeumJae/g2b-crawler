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
