const BASE_URL = 'http://apis.data.go.kr/1230000/ao/CntrctProcssIntgOpenService';

// 공공데이터포털 조달청_나라장터 계약과정통합공개서비스
// https://www.data.go.kr/data/15129459/openapi.do (수정일 2026-05-15)
// 포털 명세의 Service URL은 BASE_URL이며, 공개된 Requested Link 예시는 외자 endpoint입니다.
const CONTRACT_PROCESS_ENDPOINTS = [
  { workType: '외자', url: `${BASE_URL}/getCntrctProcssIntgOpenFrgcpt` },
  { workType: '물품', url: `${BASE_URL}/getCntrctProcssIntgOpenPrdct` },
  { workType: '용역', url: `${BASE_URL}/getCntrctProcssIntgOpenServc` },
  { workType: '공사', url: `${BASE_URL}/getCntrctProcssIntgOpenCnstwk` },
];

async function lookupByBidNumber(client, bidKey) {
  const params = {
    inqryDiv: 1,
    bidNtceNo: bidKey.bidNtceNo,
    bidNtceOrd: bidKey.bidNtceOrd,
  };
  const errors = [];

  for (const endpoint of CONTRACT_PROCESS_ENDPOINTS) {
    const result = await client.getJson(endpoint.url, params, `계약과정통합공개:${endpoint.workType}`);
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

  if (errors.length === CONTRACT_PROCESS_ENDPOINTS.length) {
    return { status: 'API 조회 실패', items: [], errors };
  }
  return { status: '정보 없음', items: [], errors };
}

module.exports = { lookupByBidNumber, CONTRACT_PROCESS_ENDPOINTS };
