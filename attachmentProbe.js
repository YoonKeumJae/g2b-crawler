const { chromium } = require('playwright');
const config = require('./config');
const { search } = require('./search');

const keyword = process.argv[2] || 'ees';
const rowIndex = Number(process.argv[3] || 0);

(async () => {
  const browser = await chromium.launch({
    headless: config.headless,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });
  const page = await context.newPage();

  try {
    const responses = [];
    const requests = [];
    page.on('response', async (response) => {
      const url = response.url();
      if (!/srchBidPbanc|selectItemAnnc|atch|file|download|pbanc|koneps/i.test(url)) return;
      const entry = { status: response.status(), url };
      if (/srchBidPbanc|selectItemAnnc|selectUntyAtchFileList/i.test(url)) {
        try {
          const text = await response.text();
          entry.bodyPreview = text.slice(0, 3000);
        } catch (err) {
          entry.bodyPreview = `unreadable: ${err.message}`;
        }
      }
      responses.push(entry);
    });
    page.on('request', (request) => {
      const url = request.url();
      if (!/fileUpload|download|UntyAtch|raonk|kupload/i.test(url)) return;
      requests.push({
        method: request.method(),
        url,
        postData: request.postData()?.slice(0, 1000) || '',
      });
    });

    await search(page, keyword, config.getDateRange());

    const searchState = await page.evaluate((rowIndexArg) => {
      const row = document.getElementById(`mf_wfm_container_grdTotalSrch_${rowIndexArg}_totalSrchTr`);
      const pattern = /첨부|파일|공고서|규격|제안|과업|다운|download|file|atch|hwp|pdf|docx|xlsx|koneps/i;
      return {
        rowText: row?.innerText || row?.textContent || '',
        rowHtml: row?.outerHTML?.slice(0, 6000) || '',
        candidates: Array.from(document.querySelectorAll('a, button, input, img, span, div'))
          .map((el) => ({
            tag: el.tagName,
            id: el.id || '',
            className: String(el.className || ''),
            text: (el.innerText || el.value || el.alt || el.title || '').trim().slice(0, 200),
            href: el.getAttribute('href') || '',
            onclick: el.getAttribute('onclick') || '',
            dataset: { ...el.dataset },
          }))
          .filter((item) => pattern.test(Object.values(item).join(' ')))
          .slice(0, 80),
      };
    }, rowIndex);

    await page.click(`#mf_wfm_container_grdTotalSrch_${rowIndex}_untyTitleTd`, { force: true });
    await Promise.race([
      page.waitForResponse((r) => r.url().includes('selectItemAnncMngV.do')).catch(() => {}),
      page.waitForSelector('[id*="bidPbancWfrm"]', { timeout: 20000 }),
    ]);
    await page.waitForTimeout(3000);

    const candidates = await page.evaluate(() => {
      const pattern = /첨부|파일|공고서|규격|제안|과업|다운|download|file|atch|hwp|pdf|docx|xlsx/i;
      return Array.from(document.querySelectorAll('a, button, input, img, span, div'))
        .map((el) => ({
          tag: el.tagName,
          id: el.id || '',
          className: String(el.className || ''),
          text: (el.innerText || el.value || el.alt || el.title || '').trim().slice(0, 200),
          href: el.getAttribute('href') || '',
          onclick: el.getAttribute('onclick') || '',
          dataset: { ...el.dataset },
        }))
        .filter((item) => pattern.test(Object.values(item).join(' ')))
        .slice(0, 120);
    });

    const fileGrids = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[id$="_grdFile"], [id*="_grdFile_"]'))
        .map((el) => ({
          id: el.id,
          tag: el.tagName,
          className: String(el.className || ''),
          text: (el.innerText || el.textContent || '').trim().slice(0, 1000),
          html: el.outerHTML.slice(0, 2000),
        }))
        .filter((item) => !/데이터가 없음/.test(item.text) || /현재 용량|파일명|download|다운로드/i.test(item.text))
        .slice(0, 80);
    });

    const uploadState = await page.evaluate(() => {
      const state = {
        hasRaonk: typeof window.RAONKUPLOAD !== 'undefined',
        raonkKeys: [],
        candidates: [],
      };
      if (!state.hasRaonk) return state;
      state.raonkKeys = Object.keys(window.RAONKUPLOAD).slice(0, 120);
      for (const id of Array.from(document.querySelectorAll('[id$="_kupload_holder"], [id*="kupload"]')).map((el) => el.id)) {
        const uploadId = id.endsWith('_kupload_holder') ? `${id}_upload` : id;
        try {
          state.candidates.push({
            id,
            uploadId,
            list: window.RAONKUPLOAD.GetListInfo?.('json', uploadId),
          });
        } catch (err) {
          state.candidates.push({ id, uploadId, error: err.message });
        }
      }
      return state;
    });

    let downloadEvent = null;
    try {
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch((err) => ({ error: err.message }));
      const started = await page.evaluate(() => {
        if (typeof window.RAONKUPLOAD === 'undefined') return false;
        const holderIds = Array.from(document.querySelectorAll('[id$="_kupload_holder"], [id*="kupload_holder"]')).map((el) => el.id);
        for (const holderId of holderIds.reverse()) {
          const uploadId = holderId.endsWith('_kupload_holder') ? `${holderId}_upload` : holderId;
          try {
            const list = window.RAONKUPLOAD.GetListInfo?.('array', uploadId);
            if (!list?.webFile?.length && !list?.mergeFile?.length) continue;
            window.RAONKUPLOAD.SetSelectFile(-1, 0, uploadId);
            window.RAONKUPLOAD.SetSelectFile(0, 1, uploadId);
            window.RAONKUPLOAD.DownloadFile(uploadId);
            return uploadId;
          } catch (_) {}
        }
        return false;
      });
      if (started) {
        const download = await downloadPromise;
        if (download.error) {
          downloadEvent = { uploadId: started, error: download.error };
        } else {
          downloadEvent = {
            uploadId: started,
            suggestedFilename: download.suggestedFilename(),
          };
          await download.cancel().catch(() => {});
        }
      } else {
        downloadEvent = { skipped: 'no upload with files found' };
      }
    } catch (err) {
      downloadEvent = { error: err.message };
    }

    console.log(JSON.stringify({ uploadState, downloadEvent, requests: requests.slice(-20) }, null, 2));
  } finally {
    await browser.close();
  }
})();
