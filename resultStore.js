const fs = require('fs');
const path = require('path');

class ResultStore {
  constructor({ outputPath, dateRange, keywords, generatedAt, bids } = {}) {
    if (!outputPath) throw new Error('outputPath is required');
    this.outputPath = outputPath;
    this.data = {
      generatedAt: generatedAt || new Date().toISOString(),
      dateRange: dateRange || null,
      keywords: keywords || [],
      bids: bids || [],
    };
  }

  static load(outputPath) {
    const raw = fs.readFileSync(outputPath, 'utf8');
    const data = JSON.parse(raw);
    return new ResultStore({
      outputPath,
      generatedAt: data.generatedAt,
      dateRange: data.dateRange,
      keywords: data.keywords,
      bids: data.bids,
    });
  }

  upsertBid(record) {
    if (!record?.bidNumber) throw new Error('record.bidNumber is required');
    const keyword = record.keyword || '';
    const index = this.data.bids.findIndex(
      (bid) => bid.bidNumber === record.bidNumber && (bid.keyword || '') === keyword
    );

    if (index === -1) {
      this.data.bids.push({
        detailFields: {},
        attachments: [],
        award: null,
        ...record,
      });
      return;
    }

    this.data.bids[index] = mergeBid(this.data.bids[index], record);
  }

  save() {
    this.data.generatedAt = new Date().toISOString();
    const dir = path.dirname(this.outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.outputPath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  toJSON() {
    return JSON.parse(JSON.stringify(this.data));
  }
}

function mergeBid(existing, next) {
  return {
    ...existing,
    ...next,
    detailFields: {
      ...(existing.detailFields || {}),
      ...(next.detailFields || {}),
    },
    attachments: next.attachments || existing.attachments || [],
    award: next.award !== undefined ? next.award : existing.award || null,
  };
}

module.exports = { ResultStore };
