const express = require('express');
const path = require('path');
const fs = require('fs');

const DATA_FILE = path.join(__dirname, 'data.json');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

let currentCode = null;
let expiryTime = 0;
let currentMeta = null;

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const obj = JSON.parse(raw);
      if (obj && obj.code && obj.expiresAt) {
        currentCode = obj.code;
        expiryTime = obj.expiresAt;
        currentMeta = obj.meta || null;
        if (Date.now() > expiryTime) {
          // expired — clear
          currentCode = null;
          expiryTime = 0;
          currentMeta = null;
        }
      }
    }
  } catch (err) {
    console.error('Failed to load data.json', err);
  }
}

function saveData() {
  try {
    const obj = { code: currentCode, expiresAt: expiryTime, meta: currentMeta };
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save data.json', err);
  }
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isExpired() {
  return !expiryTime || Date.now() > expiryTime;
}

app.post('/api/code', (req, res) => {
  const { name, street } = req.body || {};
  if (!name || !street) {
    res.status(400).json({ error: 'name_and_street_required' });
    return;
  }

  currentCode = generateCode();
  expiryTime = Date.now() + 3 * 60 * 60 * 1000;
  currentMeta = { name: String(name).trim(), street: String(street).trim() };

  // persist
  saveData();

  res.json({
    code: currentCode,
    expiresAt: expiryTime,
    meta: currentMeta
  });
});

app.post('/api/verify', (req, res) => {
  const inputCode = String(req.body && req.body.code ? req.body.code : '').trim();

  if (!/^\d{6}$/.test(inputCode)) {
    res.json({ valid: false, reason: 'format' });
    return;
  }

  if (!currentCode || !expiryTime) {
    res.json({ valid: false, reason: 'no_code' });
    return;
  }

  if (isExpired()) {
    res.json({ valid: false, reason: 'expired' });
    return;
  }

  if (inputCode === currentCode) {
    res.json({ valid: true, expiresAt: expiryTime, meta: currentMeta });
    return;
  }

  res.json({ valid: false, reason: 'mismatch' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'VICDAindex.html'));
});

app.get('/verify', (req, res) => {
  res.sendFile(path.join(__dirname, 'Vicdaverify.html'));
});

app.use(express.static(__dirname));

// load persisted data
loadData();

// Export the app for serverless platforms (or tests). When run directly, start the listener.
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`VICDA server running on http://localhost:${PORT}`);
  });
}
