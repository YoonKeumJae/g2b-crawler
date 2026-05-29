const { buildReportRows } = require('../reportRows');

test('marks contract confirmed when contract fields exist', () => {
  const rows = buildReportRows({
    keyword: 'ees',
    record: { 입찰공고번호: 'R26 - 000', 공고명: '공고', 공고기관: '기관' },
    bidKey: { bidNtceNo: 'R26', bidNtceOrd: '000', normalized: 'R26-000' },
    enrichment: { status: '확인', items: [{ cntrctEntrpsNm: '계약사', cntrctAmt: '1000', cntrctDate: '20260501' }] },
  });
  expect(rows.integrated).toMatchObject({ 리포트상태: '계약 확인', 계약업체: '계약사', 계약금액: '1000' });
  expect(rows.contract).toHaveLength(1);
});

test('marks award confirmed when only award fields exist', () => {
  const rows = buildReportRows({
    keyword: 'ees',
    record: { 입찰공고번호: 'R26 - 000' },
    bidKey: { bidNtceNo: 'R26', bidNtceOrd: '000', normalized: 'R26-000' },
    enrichment: { status: '확인', items: [{ sucsfbidEntrpsNm: '낙찰사', sucsfbidAmt: '900' }] },
  });
  expect(rows.integrated).toMatchObject({ 리포트상태: '낙찰 확인', 낙찰업체: '낙찰사', 낙찰금액: '900' });
  expect(rows.award).toHaveLength(1);
});

test('builds detail rows from every enrichment item while summary uses first item', () => {
  const rows = buildReportRows({
    keyword: 'ees',
    record: { 입찰공고번호: 'R26 - 000' },
    bidKey: { bidNtceNo: 'R26', bidNtceOrd: '000', normalized: 'R26-000' },
    enrichment: {
      status: '확인',
      items: [
        { sucsfbidEntrpsNm: '낙찰사1', sucsfbidAmt: '900' },
        { sucsfbidEntrpsNm: '낙찰사2', sucsfbidAmt: '950' },
      ],
    },
  });
  expect(rows.integrated.낙찰업체).toBe('낙찰사1');
  expect(rows.award.map((row) => row.낙찰업체)).toEqual(['낙찰사1', '낙찰사2']);
});

test('marks api failure and missing bid number deterministically', () => {
  expect(buildReportRows({
    keyword: 'ees',
    record: { 입찰공고번호: 'R26 - 000' },
    bidKey: { bidNtceNo: 'R26', bidNtceOrd: '000', normalized: 'R26-000' },
    enrichment: { status: 'API 조회 실패' },
  }).integrated.리포트상태).toBe('API 조회 실패');

  expect(buildReportRows({
    keyword: 'ees',
    record: { 공고명: '공고' },
    bidKey: null,
    enrichment: null,
  }).integrated.리포트상태).toBe('공고번호 없음');
});
