function parseBidNumber(raw) {
  if (!raw) return null;
  const text = String(raw).trim();
  const match = text.match(/^([A-Za-z0-9]+)\s*-\s*([A-Za-z0-9]+)$/);
  if (!match) return null;

  const bidNtceNo = match[1].trim();
  const bidNtceOrd = match[2].trim();
  if (!bidNtceNo || !bidNtceOrd) return null;

  return {
    bidNtceNo,
    bidNtceOrd,
    normalized: `${bidNtceNo}-${bidNtceOrd}`,
  };
}

module.exports = { parseBidNumber };
