const {
  classifyAttachment,
  downloadAttachments,
  extractAttachmentsFromDom,
  extractRaonkAttachmentsFromUploadState,
  makeUniquePath,
} = require('../attachment');

test.each([
  ['제안요청서.pdf', 'RFP'],
  ['과업지시서.hwp', 'SOW'],
  ['규격서.docx', 'SPEC'],
  ['산출내역서.xlsx', 'PRICE'],
  ['붙임자료.zip', 'OTHER'],
])('classifies %s as %s', (fileName, expected) => {
  expect(classifyAttachment(fileName)).toBe(expected);
});

test('extracts G2B attachment links and normalizes relative URLs', () => {
  const html = `
    <div id="bidPbancWfrm_mainContents">
      <a href="/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R26BK00000001&fileSeq=1">제안요청서.pdf</a>
      <a onclick="downloadFile('/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R26BK00000001&fileSeq=2')">과업지시서.hwp</a>
      <a href="/unrelated/page.do">상세보기</a>
    </div>
  `;

  const attachments = extractAttachmentsFromDom(html, {
    bidNumber: 'R26BK00000001',
    baseUrl: 'https://www.g2b.go.kr/some/page',
  });

  expect(attachments).toEqual([
    {
      bidNumber: 'R26BK00000001',
      fileName: '제안요청서.pdf',
      kind: 'RFP',
      downloadUrl: 'https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R26BK00000001&fileSeq=1',
    },
    {
      bidNumber: 'R26BK00000001',
      fileName: '과업지시서.hwp',
      kind: 'SOW',
      downloadUrl: 'https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R26BK00000001&fileSeq=2',
    },
  ]);
});

test('extracts attachment metadata from WebSquare action attributes', () => {
  const html = `
    <div>
      <button id="mf_wfm_container_bidPbancWfrm_fileGrid_0_downBtn"
        onclick="mf_wfm_container_bidPbancWfrm.downloadFile('R26BK01514945','000','1')">
        제안요청서.pdf
      </button>
      <span id="mf_wfm_container_bidPbancWfrm_fileGrid_1_fileNm">규격서.hwp</span>
      <button id="mf_wfm_container_bidPbancWfrm_fileGrid_1_downBtn"
        onclick="downloadFile('R26BK01514945','000','2')">다운로드</button>
    </div>
  `;

  expect(extractAttachmentsFromDom(html, {
    bidNumber: 'R26BK01514945',
    baseUrl: 'https://www.g2b.go.kr/',
  })).toEqual([
    expect.objectContaining({
      bidNumber: 'R26BK01514945',
      fileName: '제안요청서.pdf',
      kind: 'RFP',
      downloadUrl: 'https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R26BK01514945&bidPbancOrd=000&fileSeq=1',
    }),
    expect.objectContaining({
      bidNumber: 'R26BK01514945',
      fileName: '규격서.hwp',
      kind: 'SPEC',
      downloadUrl: 'https://www.g2b.go.kr/pn/pnp/pnpe/UntyAtchFile/downloadFile.do?bidPbancNo=R26BK01514945&bidPbancOrd=000&fileSeq=2',
    }),
  ]);
});

test('downloadAttachments records HTTP failures without throwing', async () => {
  const page = {
    context: () => ({
      request: {
        get: async () => ({
          ok: () => false,
          status: () => 403,
        }),
      },
    }),
  };

  const results = await downloadAttachments(page, [{
    bidNumber: 'R26BK01514945',
    fileName: '제안요청서.pdf',
    kind: 'RFP',
    downloadUrl: 'https://www.g2b.go.kr/file',
  }], '/tmp/crawler-attachments-test');

  expect(results).toEqual([
    expect.objectContaining({
      fileName: '제안요청서.pdf',
      downloadStatus: 'HTTP 403',
      localPath: null,
    }),
  ]);
});

test('extracts RAONK upload web files into attachment records', () => {
  const attachments = extractRaonkAttachmentsFromUploadState({
    uploadId: 'wq_uuid_7421_kupload_holder_upload',
    list: {
      webFile: {
        originalName: [
          '1. 입찰공고문(MS-EES 사용권 구매).hwp',
          '2026년 정품소프트웨어(MS EES) 사용권 구매 규격서.hwp',
        ],
        size: ['69120', '201728'],
        customValue: [
          '094a50c2-cd2d-4bca-b501-e5f973e0c2d5,1',
          '094a50c2-cd2d-4bca-b501-e5f973e0c2d5,3',
        ],
        order: ['0', '2'],
      },
    },
  }, { bidNumber: 'R26BK01514945' });

  expect(attachments).toEqual([
    expect.objectContaining({
      bidNumber: 'R26BK01514945',
      fileName: '1. 입찰공고문(MS-EES 사용권 구매).hwp',
      kind: 'OTHER',
      raonkUploadId: 'wq_uuid_7421_kupload_holder_upload',
      raonkOrder: 0,
      untyAtchFileNo: '094a50c2-cd2d-4bca-b501-e5f973e0c2d5',
      atchFileSqno: '1',
      fileSize: '69120',
    }),
    expect.objectContaining({
      fileName: '2026년 정품소프트웨어(MS EES) 사용권 구매 규격서.hwp',
      kind: 'SPEC',
      raonkOrder: 2,
      atchFileSqno: '3',
    }),
  ]);
});

test('downloadAttachments saves RAONK browser downloads', async () => {
  const calls = [];
  const page = {
    waitForEvent: async (eventName) => {
      expect(eventName).toBe('download');
      return {
        saveAs: async (localPath) => calls.push(['saveAs', localPath]),
      };
    },
    evaluate: async (fn, arg) => {
      calls.push(['evaluate', arg]);
      global.window = { RAONKUPLOAD: global.RAONKUPLOAD };
      return fn(arg);
    },
  };
  global.RAONKUPLOAD = {
    SetSelectFile: () => {},
    DownloadFile: () => {},
  };

  const results = await downloadAttachments(page, [{
    bidNumber: 'R26BK01514945',
    fileName: '제안요청서.pdf',
    kind: 'RFP',
    raonkUploadId: 'upload-id',
    raonkOrder: 1,
  }], '/tmp/crawler-attachments-test');

  delete global.RAONKUPLOAD;
  delete global.window;
  expect(calls[0]).toEqual(['evaluate', { uploadId: 'upload-id', order: 1 }]);
  expect(results[0]).toMatchObject({
    fileName: '제안요청서.pdf',
    downloadStatus: 'downloaded',
  });
});

test('makeUniquePath appends suffixes for duplicate filenames', () => {
  const used = new Set();

  expect(makeUniquePath('/tmp/bid/공고서.hwp', used)).toBe('/tmp/bid/공고서.hwp');
  expect(makeUniquePath('/tmp/bid/공고서.hwp', used)).toBe('/tmp/bid/공고서-2.hwp');
  expect(makeUniquePath('/tmp/bid/공고서.hwp', used)).toBe('/tmp/bid/공고서-3.hwp');
});
