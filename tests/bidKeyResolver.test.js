const { resolveBidKey } = require('../bidKeyResolver');

test('uses raw bid number when it already includes order', () => {
  expect(resolveBidKey({
    rawBidNumber: 'R26BK01514945 - 002',
    normalizedBidNumber: 'R26BK01514945',
    rowBidNumber: 'R26BK01514945',
  })).toMatchObject({ bidNtceNo: 'R26BK01514945', bidNtceOrd: '002' });
});

test('falls back to normalized bid number when raw value has extra text', () => {
  expect(resolveBidKey({
    rawBidNumber: '입찰공고번호: R26BK01514945 / 변경공고',
    normalizedBidNumber: 'R26BK01514945',
    rowBidNumber: 'R26BK01514945',
  })).toEqual({
    bidNtceNo: 'R26BK01514945',
    bidNtceOrd: '000',
    normalized: 'R26BK01514945-000',
  });
});

test('falls back to row bid number when normalized value is unavailable', () => {
  expect(resolveBidKey({
    rawBidNumber: '',
    normalizedBidNumber: '',
    rowBidNumber: 'R26BK01514945',
  })).toMatchObject({ bidNtceNo: 'R26BK01514945', bidNtceOrd: '000' });
});
