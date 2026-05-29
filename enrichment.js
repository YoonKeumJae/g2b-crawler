const { lookupByBidNumber } = require('./contractProcess');
const { lookupAwardByBidNumber } = require('./awardInfo');

async function lookupEnrichmentByBidNumber(client, bidKey) {
  const contractResult = await lookupByBidNumber(client, bidKey);
  if (contractResult.status === '확인') {
    return { ...contractResult, source: '계약과정통합공개' };
  }

  const awardResult = await lookupAwardByBidNumber(client, bidKey);
  if (awardResult.status === '확인') {
    return {
      ...awardResult,
      source: '낙찰정보',
      errors: [...(contractResult.errors || []), ...(awardResult.errors || [])],
    };
  }

  const errors = [...(contractResult.errors || []), ...(awardResult.errors || [])];
  if (contractResult.status === 'API 조회 실패' && awardResult.status === 'API 조회 실패') {
    return { status: 'API 조회 실패', items: [], errors };
  }

  if (contractResult.status === 'API 조회 실패' && awardResult.status === '정보 없음') {
    return { status: 'API 조회 실패', items: [], errors };
  }

  if (contractResult.status === '정보 없음' && awardResult.status === 'API 조회 실패') {
    return { status: 'API 조회 실패', items: [], errors };
  }

  return { status: '정보 없음', items: [], errors };
}

module.exports = { lookupEnrichmentByBidNumber };
