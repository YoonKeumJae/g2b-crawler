const fs = require('fs');
const path = require('path');

function classifyAttachment(fileName) {
  const normalized = String(fileName || '').replace(/\s+/g, '').toLowerCase();
  if (/제안요청서|제안요청|rfp/.test(normalized)) return 'RFP';
  if (/과업지시서|과업내용서|과업설명서|sow/.test(normalized)) return 'SOW';
  if (/규격서|사양서|시방서|spec/.test(normalized)) return 'SPEC';
  if (/산출내역서|내역서|가격|금액|price/.test(normalized)) return 'PRICE';
  return 'OTHER';
}

function extractAttachmentsFromDom(html, { bidNumber, baseUrl }) {
  const markup = String(html || '');
  const anchors = markup.match(/<a\b[\s\S]*?<\/a>/gi) || [];
  const actionElements = [
    ...(markup.match(/<(?:a|button|span|div)\b[\s\S]*?<\/(?:a|button|span|div)>/gi) || []),
    ...(markup.match(/<input\b[^>]*>/gi) || []),
  ];
  const attachments = [];
  const seen = new Set();

  for (const anchor of anchors) {
    const fileName = decodeHtml(stripTags(anchor)).trim();
    const urlCandidate = getDownloadUrlCandidate(anchor);
    if (!fileName || !urlCandidate || !/downloadFile\.do|UntyAtchFile|fileUpload\.do/i.test(urlCandidate)) {
      continue;
    }

    const downloadUrl = normalizeUrl(urlCandidate, baseUrl);
    addAttachment(attachments, seen, { bidNumber, fileName, downloadUrl });
  }

  for (let i = 0; i < actionElements.length; i++) {
    const element = actionElements[i];
    const onclick = getAttribute(element, 'onclick');
    const args = extractDownloadArgs(onclick);
    if (!args) continue;
    if (args.length === 1 && /^(?:https?:\/\/|\/)/i.test(args[0])) continue;

    const [argBidNumber, bidOrder, fileSeq] = args;
    const fileName = findFileNameNear(actionElements, i);
    if (!fileName) continue;

    addAttachment(attachments, seen, {
      bidNumber: argBidNumber || bidNumber,
      fileName,
      downloadUrl: buildG2bDownloadUrl({
        bidNumber: argBidNumber || bidNumber,
        bidOrder,
        fileSeq,
        baseUrl,
      }),
    });
  }

  return attachments;
}

async function extractAttachments(page, bidNumber) {
  const html = await page.evaluate(() => {
    const container =
      document.querySelector('[id*="bidPbancWfrm_mainContents"]') ||
      document.querySelector('[id*="bidPbancWfrm"]') ||
      document.body;
    return container.innerHTML;
  });
  const domAttachments = extractAttachmentsFromDom(html, { bidNumber, baseUrl: page.url() });
  const raonkStates = await page.evaluate(() => {
    if (typeof window.RAONKUPLOAD === 'undefined') return [];
    return Array.from(document.querySelectorAll('[id$="_kupload_holder"]'))
      .map((holder) => {
        const uploadId = `${holder.id}_upload`;
        try {
          return {
            uploadId,
            list: window.RAONKUPLOAD.GetListInfo?.('json', uploadId),
          };
        } catch (err) {
          return { uploadId, error: err.message };
        }
      });
  }).catch(() => []);
  const raonkAttachments = raonkStates.flatMap((state) =>
    extractRaonkAttachmentsFromUploadState(state, { bidNumber })
  );

  return mergeAttachments([...domAttachments, ...raonkAttachments]);
}

async function downloadAttachments(page, attachments, outputDir) {
  const results = [];
  const usedLocalPaths = new Set();
  for (const attachment of attachments) {
    const localPath = makeUniquePath(path.join(
      outputDir,
      sanitizePathSegment(attachment.bidNumber || 'unknown'),
      sanitizeFileName(attachment.fileName || 'attachment')
    ), usedLocalPaths);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });

    try {
      if (attachment.raonkUploadId) {
        const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
        await page.evaluate(({ uploadId, order }) => {
          window.RAONKUPLOAD.SetSelectFile(-1, 0, uploadId);
          window.RAONKUPLOAD.SetSelectFile(Number(order), 1, uploadId);
          window.RAONKUPLOAD.DownloadFile(uploadId);
        }, {
          uploadId: attachment.raonkUploadId,
          order: attachment.raonkOrder,
        });
        const download = await downloadPromise;
        await download.saveAs(localPath);
        results.push({ ...attachment, localPath, downloadStatus: 'downloaded' });
        continue;
      }

      const response = await page.context().request.get(attachment.downloadUrl);
      if (!response.ok()) {
        results.push({ ...attachment, localPath: null, downloadStatus: `HTTP ${response.status()}` });
        continue;
      }
      fs.writeFileSync(localPath, await response.body());
      results.push({ ...attachment, localPath, downloadStatus: 'downloaded' });
    } catch (err) {
      results.push({ ...attachment, localPath: null, downloadStatus: err.message });
    }
  }
  return results;
}

function makeUniquePath(filePath, usedLocalPaths) {
  let candidate = filePath;
  let suffix = 2;
  while (usedLocalPaths.has(candidate)) {
    const parsed = path.parse(filePath);
    candidate = path.join(parsed.dir, `${parsed.name}-${suffix}${parsed.ext}`);
    suffix++;
  }
  usedLocalPaths.add(candidate);
  return candidate;
}

function extractRaonkAttachmentsFromUploadState(state, { bidNumber }) {
  const webFile = state?.list?.webFile;
  if (!webFile) return [];

  const names = toArray(webFile.originalName);
  const sizes = toArray(webFile.size);
  const customValues = toArray(webFile.customValue);
  const orders = toArray(webFile.order);

  return names
    .map((fileName, index) => {
      if (!fileName) return null;
      const [untyAtchFileNo, atchFileSqno] = String(customValues[index] || '').split(',');
      return {
        bidNumber,
        fileName,
        kind: classifyAttachment(fileName),
        fileSize: sizes[index] || '',
        untyAtchFileNo: untyAtchFileNo || '',
        atchFileSqno: atchFileSqno || '',
        raonkUploadId: state.uploadId,
        raonkOrder: Number(orders[index] ?? index),
      };
    })
    .filter(Boolean);
}

function mergeAttachments(attachments) {
  const seen = new Set();
  const merged = [];
  for (const attachment of attachments) {
    const key = [
      attachment.fileName,
      attachment.downloadUrl || '',
      attachment.raonkUploadId || '',
      attachment.raonkOrder ?? '',
      attachment.untyAtchFileNo || '',
      attachment.atchFileSqno || '',
    ].join('\n');
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(attachment);
  }
  return merged;
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function getDownloadUrlCandidate(anchor) {
  const href = getAttribute(anchor, 'href');
  if (href && href !== '#') return decodeHtml(href);

  const onclick = getAttribute(anchor, 'onclick');
  if (!onclick) return null;
  return decodeHtml(onclick.match(/((?:https?:\/\/|\/)[^'"()]*?(?:downloadFile|fileUpload)\.do[^'"()]*)/i)?.[1]);
}

function addAttachment(attachments, seen, { bidNumber, fileName, downloadUrl }) {
  const key = `${fileName}\n${downloadUrl}`;
  if (seen.has(key)) return;
  seen.add(key);

  attachments.push({
    bidNumber,
    fileName,
    kind: classifyAttachment(fileName),
    downloadUrl,
  });
}

function extractDownloadArgs(onclick) {
  const match = String(onclick || '').match(/downloadFile\s*\(([^)]*)\)/i);
  if (!match) return null;
  return match[1]
    .split(',')
    .map((part) => decodeHtml(part.trim().replace(/^['"]|['"]$/g, '')));
}

function buildG2bDownloadUrl({ bidNumber, bidOrder, fileSeq, baseUrl }) {
  const url = new URL('/pn/pnp/pnpe/UntyAtchFile/downloadFile.do', baseUrl || 'https://www.g2b.go.kr/');
  url.searchParams.set('bidPbancNo', bidNumber);
  if (bidOrder) url.searchParams.set('bidPbancOrd', bidOrder);
  if (fileSeq) url.searchParams.set('fileSeq', fileSeq);
  return url.toString();
}

function findFileNameNear(elements, index) {
  const currentText = decodeHtml(stripTags(elements[index])).trim();
  if (looksLikeFileName(currentText)) return currentText;

  for (const offset of [-1, 1, -2, 2]) {
    const text = decodeHtml(stripTags(elements[index + offset] || '')).trim();
    if (looksLikeFileName(text)) return text;
  }

  return '';
}

function looksLikeFileName(value) {
  return /\.(pdf|hwp|hwpx|doc|docx|xls|xlsx|ppt|pptx|zip)$/i.test(String(value || '').trim());
}

function getAttribute(markup, name) {
  return (
    markup.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1] ||
    markup.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, 'i'))?.[1] ||
    ''
  );
}

function normalizeUrl(candidate, baseUrl) {
  return new URL(candidate, baseUrl || 'https://www.g2b.go.kr/').toString();
}

function stripTags(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ');
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function sanitizePathSegment(value) {
  return String(value || '').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
}

function sanitizeFileName(value) {
  const sanitized = sanitizePathSegment(value).trim();
  return sanitized || 'attachment';
}

module.exports = {
  classifyAttachment,
  extractAttachmentsFromDom,
  extractAttachments,
  downloadAttachments,
  extractDownloadArgs,
  extractRaonkAttachmentsFromUploadState,
  makeUniquePath,
};
