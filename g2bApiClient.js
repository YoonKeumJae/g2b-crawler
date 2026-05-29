class G2BApiClient {
  constructor({ serviceKey, timeoutMs = 20000, retries = 2 } = {}) {
    this.serviceKey = serviceKey;
    this.timeoutMs = timeoutMs;
    this.retries = retries;
  }

  async getJson(url, params = {}, stage = 'API') {
    if (!this.serviceKey) {
      return {
        ok: false,
        stage: 'API 설정',
        code: 'MISSING_SERVICE_KEY',
        message: 'DATA_GO_KR_SERVICE_KEY is required for award/contract enrichment',
      };
    }

    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const result = await this._attempt(url, params, stage);
      if (result.ok || !this._isRetryable(result.code)) return result;
      lastError = result;
    }
    return lastError;
  }

  async _attempt(url, params, stage) {
    const requestUrl = new URL(url);
    const query = {
      serviceKey: normalizeServiceKey(this.serviceKey),
      pageNo: 1,
      numOfRows: 10,
      type: 'json',
      ...params,
    };
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        requestUrl.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(requestUrl.toString(), { signal: controller.signal });
      if (!response.ok) {
        return {
          ok: false,
          stage,
          code: `HTTP_${response.status}`,
          message: response.statusText || `HTTP ${response.status}`,
        };
      }

      let data;
      try {
        data = await response.json();
      } catch (err) {
        return { ok: false, stage, code: 'JSON_PARSE_ERROR', message: err.message };
      }

      const header = data?.response?.header || data?.header || {};
      const resultCode = header.resultCode ?? header.ResultCode;
      if (resultCode && resultCode !== '00' && resultCode !== '0') {
        return {
          ok: false,
          stage,
          code: String(resultCode),
          message: header.resultMsg || header.ResultMsg || 'Public data API error',
          raw: data,
        };
      }

      return { ok: true, stage, items: normalizeItems(data), raw: data };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { ok: false, stage, code: 'TIMEOUT', message: `Request timed out after ${this.timeoutMs}ms` };
      }
      return { ok: false, stage, code: 'FETCH_ERROR', message: err.message };
    } finally {
      clearTimeout(timeout);
    }
  }

  _isRetryable(code) {
    return code === 'TIMEOUT' || code === 'FETCH_ERROR' || /^HTTP_5\d\d$/.test(String(code));
  }
}

function normalizeServiceKey(serviceKey) {
  const key = String(serviceKey || '');
  if (!key.includes('%')) return key;
  try {
    return decodeURIComponent(key);
  } catch (_) {
    return key;
  }
}

function normalizeItems(data) {
  const items = data?.response?.body?.items ?? data?.body?.items ?? [];
  if (Array.isArray(items)) return items.flatMap((entry) => {
    if (Array.isArray(entry.item)) return entry.item;
    if (entry.item) return [entry.item];
    return [entry];
  });
  if (Array.isArray(items.item)) return items.item;
  if (items.item) return [items.item];
  if (items && typeof items === 'object' && Object.keys(items).length > 0) return [items];
  return [];
}

module.exports = { G2BApiClient, normalizeItems, normalizeServiceKey };
