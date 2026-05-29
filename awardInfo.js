const BASE_URL = 'https://apis.data.go.kr/1230000/as/ScsbidInfoService';

// 공공데이터포털 조달청_나라장터 낙찰정보서비스
// https://www.data.go.kr/data/15129397/openapi.do (수정일 2026-05-15)
// 사용자가 제공한 End Point: https://apis.data.go.kr/1230000/as/ScsbidInfoService
const AWARD_INFO_ENDPOINTS = [
  { workType: '물품', url: `${BASE_URL}/getScsbidListSttusThng` },
  { workType: '공사', url: `${BASE_URL}/getScsbidListSttusCnstwk` },
  { workType: '용역', url: `${BASE_URL}/getScsbidListSttusServc` },
  { workType: '외자', url: `${BASE_URL}/getScsbidListSttusFrgcpt` },
];

async function lookupAwardByBidNumber(client, bidKey) {
  const params = {
    inqryDiv: 1,
    bidNtceNo: bidKey.bidNtceNo,
  };
  const errors = [];

  for (const endpoint of AWARD_INFO_ENDPOINTS) {
    const result = await client.getJson(endpoint.url, params, `낙찰정보:${endpoint.workType}`);
    if (!result.ok) {
      errors.push({
        stage: result.stage,
        code: result.code,
        message: result.message,
      });
      continue;
    }
    if (result.items.length > 0) {
      return { status: '확인', workType: endpoint.workType, items: result.items, errors };
    }
  }

  if (errors.length === AWARD_INFO_ENDPOINTS.length) {
    return { status: 'API 조회 실패', items: [], errors };
  }
  return { status: '정보 없음', items: [], errors };
}

module.exports = { lookupAwardByBidNumber, AWARD_INFO_ENDPOINTS };
