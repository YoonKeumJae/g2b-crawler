/**
 * writer.js
 * Writes crawled records into an Excel workbook using a template.
 * One sheet per keyword, named after the keyword.
 * Row 1: date range | Row 3: column headers | Row 4+: data
 */
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const TEMPLATE_PATH = path.join(__dirname, 'template.xlsx');

function fmtDate(yyyymmdd) {
  return `${yyyymmdd.slice(0, 4)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(6, 8)}`;
}

class ExcelWriter {
  constructor() {
    this.workbook = null;
    this.templateSheet = null;
    this.columnMap = {};  // header text → column index (1-based)
    this.sheets = {};     // keyword → { sheet, nextRow }
    this.outputPath = null;
  }

  async init(outputPath) {
    this.outputPath = outputPath;
    this.workbook = new ExcelJS.Workbook();
    await this.workbook.xlsx.readFile(TEMPLATE_PATH);
    this.templateSheet = this.workbook.getWorksheet(1);

    // Build column map from header row (row 3), normalized (strip spaces) for matching
    this.templateSheet.getRow(3).eachCell({ includeEmpty: false }, (cell, colNum) => {
      if (cell.value) {
        this.columnMap[cell.value] = colNum;                          // exact
        this.columnMap[cell.value.replace(/\s+/g, '')] = colNum;     // normalized
      }
    });
  }

  _getOrCreateSheet(keyword, dateRange) {
    if (this.sheets[keyword]) return this.sheets[keyword];

    const sheetName = String(keyword).slice(0, 31);
    const sheet = this.workbook.addWorksheet(sheetName);

    // Copy column widths
    this.templateSheet.columns.forEach((col, i) => {
      if (col.width) sheet.getColumn(i + 1).width = col.width;
    });

    // Clone rows 1–3 (meta row + blank row + header row)
    for (let r = 1; r <= 3; r++) {
      const srcRow = this.templateSheet.getRow(r);
      const dstRow = sheet.getRow(r);
      if (srcRow.height) dstRow.height = srcRow.height;
      srcRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        const dst = dstRow.getCell(colNum);
        if (cell.value !== null && cell.value !== undefined) dst.value = cell.value;
        if (cell.style) {
          try { dst.style = JSON.parse(JSON.stringify(cell.style)); } catch (_) {}
        }
      });
      dstRow.commit();
    }

    // Write date range into B1
    sheet.getCell('B1').value =
      `${fmtDate(dateRange.from)} ~ ${fmtDate(dateRange.to)}`;

    this.sheets[keyword] = { sheet, nextRow: 4 };
    return this.sheets[keyword];
  }

  prepareSheet(keyword, dateRange) {
    this._getOrCreateSheet(keyword, dateRange);
  }

  addRecord(keyword, dateRange, record) {
    const info = this._getOrCreateSheet(keyword, dateRange);
    const row = info.sheet.getRow(info.nextRow);
    for (const [header, colNum] of Object.entries(this.columnMap)) {
      const val = record[header];
      if (val !== undefined && val !== null && val !== '') {
        row.getCell(colNum).value = String(val);
      }
    }
    row.commit();
    info.nextRow++;
  }

  addAnalysisSheets(resultData) {
    this._addSummarySheet(resultData);
    this._addAttachmentsSheet(resultData);
    this._addAwardsSheet(resultData);
    this._addVendorSummarySheet(resultData);
  }

  _addSummarySheet(resultData) {
    const sheet = this._replaceSheet('Summary');
    const headers = [
      '키워드',
      '입찰공고번호',
      '공고명',
      '공고기관',
      '수요기관',
      '공고일',
      '입찰서마감일시',
      '개찰일시',
      '낙찰상태',
      '낙찰업체',
      '낙찰금액',
      'RFP파일수',
      '첨부파일수',
    ];
    this._writePlainTable(sheet, headers, (resultData.bids || []).map((bid) => {
      const fields = bid.detailFields || {};
      const attachments = bid.attachments || [];
      const rfpCount = attachments.filter((item) => item.kind === 'RFP').length;
      return [
        bid.keyword || '',
        bid.bidNumber || '',
        bid.title || fields.공고명 || '',
        fields.공고기관 || '',
        fields.수요기관 || '',
        fields['게시 일시'] || fields.공고일 || '',
        fields.입찰서마감일시 || fields.입찰마감일시 || '',
        fields.개찰일시 || '',
        bid.award?.status || '',
        bid.award?.winnerName || '',
        bid.award?.awardAmount || '',
        rfpCount,
        attachments.length,
      ];
    }));
  }

  _addAttachmentsSheet(resultData) {
    const sheet = this._replaceSheet('Attachments');
    const headers = ['입찰공고번호', '키워드', '파일명', '분류', '다운로드상태', '로컬경로', '원본URL'];
    const rows = [];
    for (const bid of resultData.bids || []) {
      for (const attachment of bid.attachments || []) {
        rows.push([
          bid.bidNumber || attachment.bidNumber || '',
          bid.keyword || '',
          attachment.fileName || '',
          attachment.kind || '',
          attachment.downloadStatus || '',
          attachment.localPath || '',
          attachment.downloadUrl || '',
        ]);
      }
    }
    this._writePlainTable(sheet, headers, rows);
  }

  _addAwardsSheet(resultData) {
    const sheet = this._replaceSheet('Awards');
    const headers = ['입찰공고번호', '키워드', '상태', '분류', '낙찰업체', '사업자번호', '낙찰금액', '투찰률', '개찰일자', '개찰시각', '출처', '오류'];
    const rows = (resultData.bids || []).map((bid) => {
      const award = bid.award || {};
      return [
        bid.bidNumber || '',
        bid.keyword || '',
        award.status || '',
        award.classification || '',
        award.winnerName || '',
        award.winnerBusinessNo || '',
        award.awardAmount || '',
        award.bidRate || '',
        award.openDate || '',
        award.openTime || '',
        award.source || '',
        award.error || '',
      ];
    });
    this._writePlainTable(sheet, headers, rows);
  }

  _addVendorSummarySheet(resultData) {
    const sheet = this._replaceSheet('Vendor Summary');
    const totals = new Map();

    for (const bid of resultData.bids || []) {
      const name = bid.award?.winnerName;
      if (!name) continue;
      const current = totals.get(name) || { count: 0, amount: 0 };
      current.count += 1;
      current.amount += Number(String(bid.award?.awardAmount || '0').replace(/,/g, '')) || 0;
      totals.set(name, current);
    }

    const rows = Array.from(totals.entries())
      .map(([name, value]) => [name, value.count, value.amount])
      .sort((a, b) => b[2] - a[2]);

    this._writePlainTable(sheet, ['낙찰업체', '낙찰건수', '총낙찰금액'], rows);
  }

  _replaceSheet(name) {
    const existing = this.workbook.getWorksheet(name);
    if (existing) this.workbook.removeWorksheet(existing.id);
    return this.workbook.addWorksheet(name);
  }

  _writePlainTable(sheet, headers, rows) {
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    for (const row of rows) sheet.addRow(row);
    headers.forEach((header, index) => {
      const maxLen = Math.max(
        String(header).length,
        ...rows.map((row) => String(row[index] || '').length)
      );
      sheet.getColumn(index + 1).width = Math.min(Math.max(maxLen + 2, 12), 60);
    });
  }

  async save() {
    // Remove original template sheet (Sheet1) since we created keyword sheets
    if (Object.keys(this.sheets).length > 0) {
      this.workbook.removeWorksheet(this.templateSheet.id);
    }

    const dir = path.dirname(this.outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await this.workbook.xlsx.writeFile(this.outputPath);
    console.log(`\nSaved ${this.outputPath}`);
  }
}

module.exports = { ExcelWriter };
