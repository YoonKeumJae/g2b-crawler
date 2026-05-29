const { lookupAwardByBidNumber } = require('../awardInfo');

function ok(items) {
  return { ok: true, items };
}

test('queries successful bid service by bid number and stops on first result', async () => {
  const client = { getJson: jest.fn().mockResolvedValueOnce(ok([{ bidNtceNo: 'R26', sucsfbidEntrpsNm: '낙찰사' }])) };
  const result = await lookupAwardByBidNumber(client, { bidNtceNo: 'R26', bidNtceOrd: '000' });
  expect(result.status).toBe('확인');
  expect(result.items).toEqual([{ bidNtceNo: 'R26', sucsfbidEntrpsNm: '낙찰사' }]);
  expect(client.getJson).toHaveBeenCalledTimes(1);
  expect(client.getJson.mock.calls[0][0]).toContain('/ScsbidInfoService/getScsbidListSttusThng');
  expect(client.getJson.mock.calls[0][1]).toMatchObject({ inqryDiv: 1, bidNtceNo: 'R26' });
});

test('continues across work-type endpoints and records errors', async () => {
  const client = {
    getJson: jest.fn()
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce({ ok: false, stage: '낙찰정보:공사', code: '500', message: 'fail' })
      .mockResolvedValueOnce(ok([{ bidNtceNo: 'R26' }])),
  };
  const result = await lookupAwardByBidNumber(client, { bidNtceNo: 'R26', bidNtceOrd: '000' });
  expect(result.status).toBe('확인');
  expect(result.errors).toHaveLength(1);
  expect(client.getJson).toHaveBeenCalledTimes(3);
});

test('returns no information or api failure deterministically', async () => {
  const noInfoClient = { getJson: jest.fn().mockResolvedValue(ok([])) };
  await expect(lookupAwardByBidNumber(noInfoClient, { bidNtceNo: 'R26' }))
    .resolves.toMatchObject({ status: '정보 없음', items: [] });

  const failingClient = { getJson: jest.fn().mockResolvedValue({ ok: false, code: '500', message: 'fail' }) };
  await expect(lookupAwardByBidNumber(failingClient, { bidNtceNo: 'R26' }))
    .resolves.toMatchObject({ status: 'API 조회 실패', items: [] });
});
