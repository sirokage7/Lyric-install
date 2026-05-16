const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const codesPath = path.join(__dirname, '../data/admin-codes.json');
const usersPath = path.join(__dirname, '../data/admin-users.json');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadCodes() {
  try {
    if (!fs.existsSync(codesPath)) return [];
    return JSON.parse(fs.readFileSync(codesPath, 'utf8'));
  } catch { return []; }
}

function saveCodes(codes) {
  ensureDir(codesPath);
  fs.writeFileSync(codesPath, JSON.stringify(codes, null, 2));
}

function loadUsers() {
  try {
    if (!fs.existsSync(usersPath)) return [];
    return JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  } catch { return []; }
}

function saveUsers(users) {
  ensureDir(usersPath);
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

function isRegistered(userId) {
  return loadUsers().includes(userId);
}

function registerUser(userId, userName, code) {
  const users = loadUsers();
  if (!users.includes(userId)) {
    users.push(userId);
    saveUsers(users);
  }
  if (code) {
    const codes = loadCodes();
    const entry = codes.find((c) => c.code === code);
    if (entry) {
      entry.usedBy = { id: userId, name: userName };
      saveCodes(codes);
    }
  }
}

function generateCode() {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}

module.exports = { loadCodes, saveCodes, loadUsers, saveUsers, isRegistered, registerUser, generateCode };
