const {
  classifyAwardStatus,
  inferBusinessType,
  inferOpeningDate,
  lookupAwardViaOpenApi,
  normalizeSuccessfulBid,
} = require('./award');

async function lookupAwardForResultStore({
  apiEnabled = true,
  apiKey,
  bidNumber,
  record,
  enrichment,
  lookup = lookupAwardViaOpenApi,
}) {
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

  const enrichedAward = awardFromEnrichment(enrichment);
  if (enrichedAward) {
    enrichedAward.classification = classifyAwardStatus({ award: enrichedAward, detailFields: record });
    return enrichedAward;
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

function awardFromEnrichment(enrichment) {
  if (enrichment?.status !== '확인' || enrichment?.source !== '낙찰정보') return null;

  for (const item of enrichment.items || []) {
    const award = normalizeSuccessfulBid({
      bsnsDivNm: enrichment.workType,
      ...item,
    });
    if (award.winnerName || award.awardAmount) return award;
  }
  return null;
}

module.exports = { lookupAwardForResultStore, awardFromEnrichment };
