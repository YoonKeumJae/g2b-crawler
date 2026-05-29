const { parseBidNumber } = require('../bidKey');

test('parses bid number with spaced hyphen', () => {
  expect(parseBidNumber('R26BK01514945 - 000')).toEqual({
    bidNtceNo: 'R26BK01514945',
    bidNtceOrd: '000',
    normalized: 'R26BK01514945-000',
  });
});

test('parses bid number without spaces', () => {
  expect(parseBidNumber('R26BK01514945-000')).toEqual({
    bidNtceNo: 'R26BK01514945',
    bidNtceOrd: '000',
    normalized: 'R26BK01514945-000',
  });
});

test('returns null for empty or incomplete values', () => {
  expect(parseBidNumber('')).toBeNull();
  expect(parseBidNumber('R26BK01514945')).toBeNull();
  expect(parseBidNumber(' - 000')).toBeNull();
});

test('returns null for malformed values', () => {
  expect(parseBidNumber('abc-def-ghi')).toBeNull();
});
