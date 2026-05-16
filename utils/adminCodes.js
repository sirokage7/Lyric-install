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
    const data = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    // 구버전 호환 (string 배열 → object 배열)
    return data.map((u) => typeof u === 'string' ? { id: u, name: '알 수 없음', issuedBy: null } : u);
  } catch { return []; }
}

function saveUsers(users) {
  ensureDir(usersPath);
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

function isRegistered(userId) {
  return loadUsers().some((u) => u.id === userId);
}

function registerUser(userId, userName, code) {
  const users = loadUsers();
  if (!users.some((u) => u.id === userId)) {
    const codes = loadCodes();
    const entry = codes.find((c) => c.code === code);
    users.push({ id: userId, name: userName, issuedBy: entry?.issuedBy ?? null });
    saveUsers(users);
    // 일회용: 사용된 코드 삭제
    saveCodes(codes.filter((c) => c.code !== code));
  }
}

function unregisterUser(userId) {
  saveUsers(loadUsers().filter((u) => u.id !== userId));
}

function generateCode() {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}

module.exports = { loadCodes, saveCodes, loadUsers, saveUsers, isRegistered, registerUser, unregisterUser, generateCode };
