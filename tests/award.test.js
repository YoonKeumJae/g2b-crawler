const { classifyAwardStatus, normalizeBidNumber, normalizeSuccessfulBid, lookupAwardViaOpenApi } = require('../award');

test('normalizes successful bid API fields into crawler award shape', () => {
  const award = normalizeSuccessfulBid({
    bidNtceNo: 'R26BK00000001',
    opengRsltDivNm: '개찰완료',
    fnlSucsfCorpNm: '낙찰 주식회사',
    fnlSucsfCorpBizrno: '1234567890',
    fnlSucsfAmt: '1000000',
    fnlSucsfRt: '88.123',
    opengDate: '20260501',
    opengTm: '1100',
    bsnsDivNm: '용역',
  });

  expect(award).toEqual({
    source: 'data.go.kr',
    status: '개찰완료',
    winnerName: '낙찰 주식회사',
    winnerBusinessNo: '1234567890',
    awardAmount: '1000000',
    bidRate: '88.123',
    openDate: '20260501',
    openTime: '1100',
    businessType: '용역',
    raw: expect.objectContaining({ bidNtceNo: 'R26BK00000001' }),
  });
});

test('normalizes current successful bid service winner fields', () => {
  const award = normalizeSuccessfulBid({
    bidNtceNo: 'R26BK01514945',
    bidwinnrNm: '주식회사 디모아',
    bidwinnrBizno: '1068150113',
    sucsfbidAmt: '1889610000',
    sucsfbidRate: '82.515',
    rlOpengDt: '2026-05-19 11:00:00',
  });

  expect(award).toMatchObject({
    status: '낙찰',
    winnerName: '주식회사 디모아',
    winnerBusinessNo: '1068150113',
    awardAmount: '1889610000',
    bidRate: '82.515',
    openDate: '2026-05-19 11:00:00',
  });
});


test('lookupAwardViaOpenApi returns the matching award from data.go.kr response', async () => {
  const fetchImpl = jest.fn(async (url) => {
    expect(url.toString()).toContain('getScsbidListSttusThng');
    expect(url.searchParams.get('bidNtceNo')).toBe('R26BK00000001');
    expect(url.searchParams.get('inqryDiv')).toBe('4');
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          response: {
            header: { resultCode: '00' },
            body: {
              items: [
                { bidNtceNo: 'R26BK99999999', fnlSucsfCorpNm: '다른 업체' },
                { bidNtceNo: 'R26BK00000001', fnlSucsfCorpNm: '낙찰 주식회사', opengRsltDivNm: '개찰완료' },
              ],
            },
          },
        });
      },
    };
  });

  const award = await lookupAwardViaOpenApi({
    apiKey: 'test-key',
    bidNumber: 'R26BK00000001 - 000',
    businessType: '물품',
    openingDate: '20260501',
    fetchImpl,
  });

  expect(award).toMatchObject({
    status: '개찰완료',
    winnerName: '낙찰 주식회사',
  });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test('normalizes G2B bid number values that include order suffixes', () => {
  expect(normalizeBidNumber('R26BK00000001 - 000')).toBe('R26BK00000001');
});

test('lookupAwardViaOpenApi returns API error messages from official error wrapper', async () => {
  const fetchImpl = jest.fn(async () => ({
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({
        'nkoneps.com.response.ResponseError': {
          header: { resultCode: '08', resultMsg: '필수값 입력 에러' },
        },
      });
    },
  }));

  await expect(lookupAwardViaOpenApi({
    apiKey: 'test-key',
    bidNumber: 'R26BK00000001',
    fetchImpl,
  })).resolves.toMatchObject({
    status: 'lookup_failed',
    error: '08: 필수값 입력 에러',
  });
});

test('lookupAwardViaOpenApi tries service endpoint when goods endpoint has no match', async () => {
  const called = [];
  const fetchImpl = jest.fn(async (url) => {
    const endpoint = url.pathname.split('/').pop();
    called.push(endpoint);
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          response: {
            header: { resultCode: '00' },
            body: {
              items: endpoint === 'getScsbidListSttusServc'
                ? [{ bidNtceNo: 'R26BK00000001', bidwinnrNm: '서비스 낙찰사' }]
                : [],
            },
          },
        });
      },
    };
  });

  const result = await lookupAwardViaOpenApi({
    apiKey: 'test-key',
    bidNumber: 'R26BK00000001',
    businessType: '용역',
    fetchImpl,
  });

  expect(result.winnerName).toBe('서비스 낙찰사');
  expect(called).toContain('getScsbidListSttusServc');
});

test('classifies not found awards with a stable reason', () => {
  expect(classifyAwardStatus({
    award: { status: 'not_found' },
    detailFields: { 공고종류: '실공고(등록공고)', 개찰일시: '2026/07/01 11:00:00' },
    now: new Date('2026-05-28T00:00:00+09:00'),
  })).toBe('not_opened_yet');
});
