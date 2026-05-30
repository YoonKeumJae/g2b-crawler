const { G2BApiClient } = require('../g2bApiClient');

afterEach(() => {
  jest.useRealTimers();
  delete global.fetch;
});

test('requires service key before network calls', async () => {
  global.fetch = jest.fn();
  const client = new G2BApiClient({ serviceKey: '' });
  const result = await client.getJson('https://example.test/api', {});
  expect(result).toMatchObject({
    ok: false,
    stage: 'API 설정',
    code: 'MISSING_SERVICE_KEY',
  });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('returns parsed items on success and includes default query parameters', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      response: {
        header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
        body: { items: [{ item: { bidNtceNo: 'R26' } }] },
      },
    }),
  });
  const client = new G2BApiClient({ serviceKey: 'key' });
  const result = await client.getJson('https://example.test/api', { bidNtceNo: 'R26' });
  const calledUrl = new URL(global.fetch.mock.calls[0][0]);
  expect(calledUrl.searchParams.get('serviceKey')).toBe('key');
  expect(calledUrl.searchParams.get('pageNo')).toBe('1');
  expect(calledUrl.searchParams.get('numOfRows')).toBe('10');
  expect(calledUrl.searchParams.get('type')).toBe('json');
  expect(result.ok).toBe(true);
  expect(result.items).toEqual([{ bidNtceNo: 'R26' }]);
});

test('follows pagination until all rows are returned', async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response: {
          header: { resultCode: '00' },
          body: {
            pageNo: 1,
            numOfRows: 2,
            totalCount: 3,
            items: [{ item: { bidNtceNo: 'R26-1' } }, { item: { bidNtceNo: 'R26-2' } }],
          },
        },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response: {
          header: { resultCode: '00' },
          body: {
            pageNo: 2,
            numOfRows: 2,
            totalCount: 3,
            items: [{ item: { bidNtceNo: 'R26-3' } }],
          },
        },
      }),
    });

  const client = new G2BApiClient({ serviceKey: 'key' });
  const result = await client.getJson('https://example.test/api', { bidNtceNo: 'R26' });
  expect(result.ok).toBe(true);
  expect(result.items.map((item) => item.bidNtceNo)).toEqual(['R26-1', 'R26-2', 'R26-3']);
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(new URL(global.fetch.mock.calls[1][0]).searchParams.get('pageNo')).toBe('2');
});

test('normalizes an already encoded service key before URL encoding', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ response: { header: { resultCode: '00' }, body: { items: [] } } }),
  });
  const client = new G2BApiClient({ serviceKey: 'abc%2Fdef%3D%3D' });
  await client.getJson('https://example.test/api', {});
  const calledUrl = new URL(global.fetch.mock.calls[0][0]);
  expect(calledUrl.searchParams.get('serviceKey')).toBe('abc/def==');
  expect(global.fetch.mock.calls[0][0]).toContain('serviceKey=abc%2Fdef%3D%3D');
});

test('distinguishes http, json parse, api header, and timeout failures', async () => {
  const client = new G2BApiClient({ serviceKey: 'key', timeoutMs: 5, retries: 0 });

  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });
  await expect(client.getJson('https://example.test/api', {})).resolves.toMatchObject({ ok: false, code: 'HTTP_500' });

  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error('bad json'); } });
  await expect(client.getJson('https://example.test/api', {})).resolves.toMatchObject({ ok: false, code: 'JSON_PARSE_ERROR' });

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ response: { header: { resultCode: '30', resultMsg: 'SERVICE KEY IS NOT REGISTERED' } } }),
  });
  await expect(client.getJson('https://example.test/api', {})).resolves.toMatchObject({ ok: false, code: '30' });

  global.fetch = jest.fn((_url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  }));
  await expect(client.getJson('https://example.test/api', {})).resolves.toMatchObject({ ok: false, code: 'TIMEOUT' });
});
