const { parseBidNumber } = require('./bidKey');

function resolveBidKey({ rawBidNumber, normalizedBidNumber, rowBidNumber }) {
  return (
    parseBidNumber(rawBidNumber) ||
    parseBidNumber(rowBidNumber) ||
    parseBidNumber(normalizedBidNumber ? `${normalizedBidNumber} - 000` : '') ||
    parseBidNumber(rowBidNumber ? `${rowBidNumber} - 000` : '')
  );
}

module.exports = { resolveBidKey };
