const { parseBidNumber } = require('./bidKey');

function resolveBidKey({ rawBidNumber, normalizedBidNumber, rowBidNumber }) {
  return (
    parseBidNumber(rawBidNumber) ||
    parseBidNumber(normalizedBidNumber ? `${normalizedBidNumber} - 000` : '') ||
    parseBidNumber(rowBidNumber) ||
    parseBidNumber(rowBidNumber ? `${rowBidNumber} - 000` : '')
  );
}

module.exports = { resolveBidKey };
