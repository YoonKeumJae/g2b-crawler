const { classifyAwardStatus, inferBusinessType, inferOpeningDate, lookupAwardViaOpenApi } = require('./award');

async function lookupAwardForResultStore({ apiEnabled = true, apiKey, bidNumber, record, lookup = lookupAwardViaOpenApi }) {
  if (!apiEnabled) {
    return {
      source: 'data.go.kr',
      status: 'not_configured',
      classification: 'not_configured',
      error: 'API enrichment is disabled',
    };
  }

  if (!bidNumber) {
    return {
      source: 'data.go.kr',
      status: 'not_found',
      classification: 'not_found',
      error: 'bidNumber is missing',
    };
  }

  let award;
  try {
    award = await lookup({
      apiKey,
      bidNumber,
      businessType: inferBusinessType(record),
      openingDate: inferOpeningDate(record),
    });
  } catch (err) {
    award = {
      source: 'data.go.kr',
      status: 'lookup_failed',
      error: err.message,
    };
  }
  award.classification = classifyAwardStatus({ award, detailFields: record });
  return award;
}

module.exports = { lookupAwardForResultStore };
