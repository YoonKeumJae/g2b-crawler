const INTEGRATED_HEADERS = [
  '검색키워드',
  '입찰공고번호',
  '공고차수',
  '공고명',
  '공고기관',
  '수요기관',
  '사업금액',
  '배정예산',
  '추정가격',
  '사전규격등록번호',
  '발주계획번호',
  '낙찰상태',
  '낙찰업체',
  '낙찰금액',
  '낙찰률',
  '계약상태',
  '계약업체',
  '계약금액',
  '계약일자',
  '계약기간',
  '리포트상태',
];

const AWARD_HEADERS = ['입찰공고번호', '낙찰업체', '낙찰금액', '낙찰률', '원본업무구분', '원본JSON'];
const CONTRACT_HEADERS = ['입찰공고번호', '계약업체', '계약금액', '계약일자', '계약기간', '원본업무구분', '원본JSON'];
const ERROR_HEADERS = ['검색키워드', '입찰공고번호', '단계', '오류코드', '오류메시지'];

function buildReportRows({ keyword, record = {}, bidKey, enrichment }) {
  const awardRows = [];
  const contractRows = [];
  let award = emptyAward();
  let contract = emptyContract();

  for (const item of enrichment?.items || []) {
    const itemAward = pickAward(item);
    if (itemAward.company || itemAward.amount) {
      if (!award.company && !award.amount) award = itemAward;
      awardRows.push(awardRow(bidKey, itemAward, enrichment, item));
    }

    const itemContract = pickContract(item);
    if (itemContract.company || itemContract.amount) {
      if (!contract.company && !contract.amount) contract = itemContract;
      contractRows.push(contractRow(bidKey, itemContract, enrichment, item));
    }
  }

  const integrated = {};
  INTEGRATED_HEADERS.forEach((header) => { integrated[header] = ''; });
  integrated.검색키워드 = value(keyword);
  integrated.입찰공고번호 = value(bidKey?.bidNtceNo || record.입찰공고번호);
  integrated.공고차수 = value(bidKey?.bidNtceOrd);
  integrated.공고명 = value(record.공고명);
  integrated.공고기관 = value(record.공고기관);
  integrated.수요기관 = value(record.수요기관);
  integrated.사업금액 = value(record['사업금액 (추정가격 + 부가세)'] || record.사업금액);
  integrated.배정예산 = value(record.배정예산);
  integrated.추정가격 = value(record.추정가격);
  integrated.사전규격등록번호 = value(record.사전규격등록번호);
  integrated.발주계획번호 = value(record.발주계획번호);
  integrated.낙찰상태 = award.company || award.amount ? '확인' : '';
  integrated.낙찰업체 = award.company;
  integrated.낙찰금액 = award.amount;
  integrated.낙찰률 = award.rate;
  integrated.계약상태 = contract.company || contract.amount ? '확인' : '';
  integrated.계약업체 = contract.company;
  integrated.계약금액 = contract.amount;
  integrated.계약일자 = contract.date;
  integrated.계약기간 = contract.period;
  integrated.리포트상태 = getReportStatus({ bidKey, enrichment, award, contract });

  return {
    integrated,
    award: awardRows,
    contract: contractRows,
    errors: (enrichment?.errors || []).map((error) => ({
      검색키워드: value(keyword),
      입찰공고번호: value(bidKey?.bidNtceNo || record.입찰공고번호),
      단계: value(error.stage),
      오류코드: value(error.code),
      오류메시지: value(error.message),
    })),
  };
}

function getReportStatus({ bidKey, enrichment, award, contract }) {
  if (!bidKey) return '공고번호 없음';
  if (enrichment?.status === 'API 조회 실패') return 'API 조회 실패';
  if (contract.company || contract.amount) return '계약 확인';
  if (award.company || award.amount) return '낙찰 확인';
  return '공고만 확인';
}

function pickAward(item) {
  return {
    company: value(firstOf(item, ['sucsfbidEntrpsNm', 'sucsfbidCorpNm', 'sucsfbidderNm', '낙찰업체'])),
    amount: value(firstOf(item, ['sucsfbidAmt', 'sucsfbidPrice', '낙찰금액'])),
    rate: value(firstOf(item, ['sucsfbidRate', 'bidRate', '낙찰률'])),
  };
}

function emptyAward() {
  return { company: '', amount: '', rate: '' };
}

function pickContract(item) {
  const start = firstOf(item, ['cntrctBeginDate', 'cntrctPrdBeginDate', '계약시작일']);
  const end = firstOf(item, ['cntrctEndDate', 'cntrctPrdEndDate', '계약종료일']);
  return {
    company: value(firstOf(item, ['cntrctEntrpsNm', 'cntrctCorpNm', 'cntrctCnclsEntrpsNm', '계약업체'])),
    amount: value(firstOf(item, ['cntrctAmt', 'cntrctPrice', '계약금액'])),
    date: value(firstOf(item, ['cntrctDate', 'cntrctCnclsDate', '계약일자'])),
    period: start || end ? `${value(start)} ~ ${value(end)}` : value(firstOf(item, ['cntrctPrd', '계약기간'])),
  };
}

function emptyContract() {
  return { company: '', amount: '', date: '', period: '' };
}

function awardRow(bidKey, award, enrichment, raw) {
  return {
    입찰공고번호: value(bidKey?.bidNtceNo),
    낙찰업체: award.company,
    낙찰금액: award.amount,
    낙찰률: award.rate,
    원본업무구분: value(enrichment?.workType),
    원본JSON: JSON.stringify(raw),
  };
}

function contractRow(bidKey, contract, enrichment, raw) {
  return {
    입찰공고번호: value(bidKey?.bidNtceNo),
    계약업체: contract.company,
    계약금액: contract.amount,
    계약일자: contract.date,
    계약기간: contract.period,
    원본업무구분: value(enrichment?.workType),
    원본JSON: JSON.stringify(raw),
  };
}

function firstOf(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return '';
}

function value(input) {
  if (input === undefined || input === null) return '';
  return String(input);
}

module.exports = {
  buildReportRows,
  INTEGRATED_HEADERS,
  AWARD_HEADERS,
  CONTRACT_HEADERS,
  ERROR_HEADERS,
};
