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
