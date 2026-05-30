const OPEN_API_BASE_URL = 'https://apis.data.go.kr/1230000/as/ScsbidInfoService';
const AWARD_ENDPOINTS = {
  물품: 'getScsbidListSttusThng',
  공사: 'getScsbidListSttusCnstwk',
  용역: 'getScsbidListSttusServc',
  외자: 'getScsbidListSttusFrgcpt',
};

function normalizeSuccessfulBid(item) {
  if (!item) return null;
  return {
    source: 'data.go.kr',
    status: pick(item, ['opengRsltDivNm', 'cntrctCnclsSttusNm']) || (pick(item, ['bidwinnrNm']) ? '낙찰' : ''),
    winnerName: pick(item, ['fnlSucsfCorpNm', 'bidprcCorpNm', 'bidwinnrNm']),
    winnerBusinessNo: pick(item, ['fnlSucsfCorpBizrno', 'bidprcCorpBizrno', 'bidwinnrBizrno', 'bidwinnrBizno']),
    awardAmount: pick(item, ['fnlSucsfAmt', 'bidprcAmt', 'sucsfbidAmt']),
    bidRate: pick(item, ['fnlSucsfRt', 'bidprcRt', 'sucsfbidRate']),
    openDate: pick(item, ['opengDate', 'opengDt', 'rlOpengDt']),
    openTime: pick(item, ['opengTm', 'opengTime']),
    businessType: item.bsnsDivNm || '',
    raw: item,
  };
}

async function lookupAwardViaOpenApi({
  apiKey,
  bidNumber,
  businessType,
  openingDate,
  fetchImpl = global.fetch,
}) {
  if (!apiKey) {
    return {
      source: 'data.go.kr',
      status: 'not_configured',
      error: 'DATA_GO_KR_API_KEY is not set',
    };
  }
  if (!bidNumber) throw new Error('bidNumber is required');
  if (!fetchImpl) throw new Error('fetch is not available in this Node.js runtime');

  const { from, to } = oneWeekWindow(openingDate);
  const endpoints = endpointOrderForBusinessType(businessType);

  for (const endpoint of endpoints) {
    const normalizedBidNumber = normalizeBidNumber(bidNumber);
    const url = new URL(`${OPEN_API_BASE_URL}/${endpoint}`);
    url.searchParams.set('serviceKey', decodeURIComponent(apiKey));
    url.searchParams.set('type', 'json');
    url.searchParams.set('inqryDiv', '4');
    url.searchParams.set('bidNtceNo', normalizedBidNumber);
    url.searchParams.set('inqryBgnDt', `${from}0000`);
    url.searchParams.set('inqryEndDt', `${to}2359`);
    url.searchParams.set('numOfRows', '999');
    url.searchParams.set('pageNo', '1');

    const response = await fetchImpl(url);
    if (!response.ok) {
      return {
        source: 'data.go.kr',
        status: 'lookup_failed',
        error: `HTTP ${response.status}`,
      };
    }

    let data;
    try {
      data = JSON.parse(await response.text());
    } catch (err) {
      return {
        source: 'data.go.kr',
        status: 'lookup_failed',
        error: `Invalid JSON response: ${err.message}`,
      };
    }
    const responseData = data.response || data['nkoneps.com.response.ResponseError'];
    const resultCode = responseData?.header?.resultCode;
    if (resultCode && resultCode !== '00') {
      return {
        source: 'data.go.kr',
        status: 'lookup_failed',
        error: `${resultCode}: ${responseData?.header?.resultMsg || 'API error'}`,
      };
    }
    const items = normalizeItems(data?.response?.body?.items);
    const match = items.find((item) => normalizeBidNumber(item.bidNtceNo || '') === normalizedBidNumber);
    if (match) return normalizeSuccessfulBid(match);
  }

  return {
    source: 'data.go.kr',
    status: 'not_found',
  };
}

function inferOpeningDate(detailFields) {
  const raw = pick(detailFields || {}, ['개찰일시', '개찰일자', '개찰일']);
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(0, 8) : null;
}

function inferBusinessType(detailFields) {
  const text = [
    detailFields?.업무구분,
    detailFields?.공고종류,
    detailFields?.입찰방식,
    detailFields?.공고명,
  ].filter(Boolean).join(' ');
  if (/공사/.test(text)) return '공사';
  if (/용역|운영|유지보수|개발|컨설팅/.test(text)) return '용역';
  if (/외자/.test(text)) return '외자';
  return '물품';
}

function classifyAwardStatus({ award, detailFields, now = new Date() }) {
  if (award?.winnerName) return 'awarded';
  if (award?.status === 'lookup_failed') return 'lookup_failed';
  if (award?.status === 'not_configured') return 'not_configured';

  const openingDate = inferOpeningDate(detailFields);
  if (openingDate) {
    const openedAt = new Date(`${openingDate.slice(0, 4)}-${openingDate.slice(4, 6)}-${openingDate.slice(6, 8)}T23:59:59+09:00`);
    if (openedAt > now) return 'not_opened_yet';
  }

  const text = Object.values(detailFields || {}).join(' ');
  if (/유찰/.test(text)) return 'failed_bid_possible';
  if (/재입찰/.test(text)) return 'rebid_possible';
  return 'not_found';
}

function normalizeBidNumber(value) {
  return String(value || '').match(/[A-Z]\d{2}[A-Z]{2}\d{8}/)?.[0] || String(value || '').trim();
}

function endpointOrderForBusinessType(businessType) {
  const normalized = normalizeBusinessType(businessType);
  const primary = AWARD_ENDPOINTS[normalized] || AWARD_ENDPOINTS.물품;
  return [primary, ...Object.values(AWARD_ENDPOINTS).filter((endpoint) => endpoint !== primary)];
}

function pick(source, keys) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== '') return String(source[key]);
  }
  return '';
}

function normalizeItems(items) {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if (Array.isArray(items.item)) return items.item;
  if (items.item) return [items.item];
  return [];
}

function normalizeBusinessType(value) {
  const normalized = String(value || '').trim();
  const map = {
    '1': '물품',
    '2': '외자',
    '3': '공사',
    '5': '용역',
    물품: '물품',
    외자: '외자',
    공사: '공사',
    용역: '용역',
  };
  return map[normalized] || normalized || '물품';
}

function oneWeekWindow(yyyymmdd) {
  if (!yyyymmdd) {
    const today = calendarDateFromKst(new Date());
    return { from: fmtDate(addDays(today, -6)), to: fmtDate(today) };
  }

  const date = new Date(Date.UTC(
    Number(yyyymmdd.slice(0, 4)),
    Number(yyyymmdd.slice(4, 6)) - 1,
    Number(yyyymmdd.slice(6, 8)),
  ));
  return { from: fmtDate(addDays(date, -3)), to: fmtDate(addDays(date, 3)) };
}

function calendarDateFromKst(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function fmtDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

module.exports = {
  normalizeSuccessfulBid,
  lookupAwardViaOpenApi,
  inferOpeningDate,
  inferBusinessType,
  classifyAwardStatus,
  normalizeBidNumber,
  endpointOrderForBusinessType,
};
