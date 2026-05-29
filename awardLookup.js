const { classifyAwardStatus, inferBusinessType, inferOpeningDate, lookupAwardViaOpenApi } = require('./award');

async function lookupAwardForResultStore({ apiKey, bidNumber, record, lookup = lookupAwardViaOpenApi }) {
  if (!bidNumber) {
    return {
      source: 'data.go.kr',
      status: 'not_found',
      classification: 'not_found',
      error: 'bidNumber is missing',
    };
  }

  const award = await lookup({
    apiKey,
    bidNumber,
    businessType: inferBusinessType(record),
    openingDate: inferOpeningDate(record),
  });
  award.classification = classifyAwardStatus({ award, detailFields: record });
  return award;
}

module.exports = { lookupAwardForResultStore };
