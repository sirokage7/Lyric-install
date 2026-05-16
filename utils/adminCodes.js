const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const codesPath = path.join(__dirname, '../data/admin-codes.json');

function loadCodes() {
  try {
    if (!fs.existsSync(codesPath)) return [];
    return JSON.parse(fs.readFileSync(codesPath, 'utf8'));
  } catch { return []; }
}

function saveCodes(codes) {
  const dir = path.dirname(codesPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(codesPath, JSON.stringify(codes, null, 2));
}

function generateCode() {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}

module.exports = { loadCodes, saveCodes, generateCode };
