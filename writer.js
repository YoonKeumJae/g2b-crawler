const fs = require('fs');
const path = require('path');

let headers = null;

function write(outputPath, record) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (headers === null) {
    headers = Object.keys(record);
    // UTF-8 BOM required for Excel to correctly display Korean characters
    fs.writeFileSync(outputPath, '\uFEFF' + headers.join(',') + '\n');
  } else {
    const newFields = Object.keys(record).filter(k => !headers.includes(k));
    if (newFields.length > 0) {
      console.warn(`[writer] Warning: new fields not in CSV header will be dropped: ${newFields.join(', ')}`);
    }
  }

  const row = headers
    .map((h) => `"${(record[h] || '').toString().replace(/"/g, '""')}"`)
    .join(',');
  fs.appendFileSync(outputPath, row + '\n');
}

function reset() {
  headers = null;
}

module.exports = { write, reset };
