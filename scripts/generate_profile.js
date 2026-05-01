#!/usr/bin/env node
// generate_profile.js — runs in GitHub Actions
// Reads live session count + lifetime_log, generates profile.svg
// Commits to DART-Skyboard/Autumn so the README badge stays live

const fs   = require('fs');
const path = require('path');
const https = require('https');

const ASH_REPO = 'DART-Skyboard/leatr-ash';
const OUT_REPO = 'DART-Skyboard/Autumn';
const TOKEN    = process.env.LEATR_ASH_PAT || process.env.GITHUB_TOKEN;

function ghGet(repoPath) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: `/repos/${repoPath}`,
      headers: { 'Authorization': `token ${TOKEN}`, 'User-Agent': 'AutumnProfileGen/1.0' }
    };
    https.get(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function main() {
  // 1. Read lifetime_log.json from leatr-ash
  let allTimeUsers = '—', allTimeSessions = '—';
  try {
    const logFile = await ghGet(`${ASH_REPO}/contents/ashtree/analytics/lifetime_log.json`);
    if (logFile.content) {
      const log = JSON.parse(Buffer.from(logFile.content.replace(/\n/g,''), 'base64').toString());
      allTimeUsers    = String(log.totals?.all_time_unique_users || '—');
      allTimeSessions = String(log.totals?.all_time_sessions     || '—');
    }
  } catch(e) { console.error('lifetime_log fetch failed:', e.message); }

  // 2. Count active session files (each file = one user session)
  let activeSessions = 0;
  try {
    const sessions = await ghGet(`${ASH_REPO}/contents/ashtree/sessions`);
    if (Array.isArray(sessions)) {
      const EPOCH_MIN = 1700000000000;
      const EPOCH_MAX = 1900000000000;
      const now = Date.now();
      const ACTIVE_WINDOW = 30 * 60 * 1000; // 30 min = "active"
      activeSessions = sessions.filter(f => {
        if (!f.name.endsWith('.json') || f.name === '_index.json') return false;
        const m = f.name.match(/_t([0-9a-z]{8})/i);
        if (!m) return false;
        const ts = parseInt(m[1], 36);
        return ts > EPOCH_MIN && ts < EPOCH_MAX && (now - ts) < ACTIVE_WINDOW;
      }).length;
    }
  } catch(e) { console.error('sessions fetch failed:', e.message); }

  // 3. Generate SVG
  const updatedAt = new Date().toISOString().slice(0,16).replace('T',' ') + ' UTC';
  let svg = fs.readFileSync(path.join(__dirname, 'profile_template.svg'), 'utf8');
  svg = svg
    .replace(/%%ACTIVE_USERS%%/g,     String(activeSessions || 0))
    .replace(/%%ALL_TIME_USERS%%/g,    allTimeUsers)
    .replace(/%%ALL_TIME_SESSIONS%%/g, allTimeSessions)
    .replace(/%%UPDATED_AT%%/g,        updatedAt);

  fs.writeFileSync(path.join(__dirname, '..', 'profile.svg'), svg);
  console.log(`✓ profile.svg generated — ${activeSessions} active, ${allTimeUsers} all-time users`);
}

main().catch(e => { console.error(e); process.exit(1); });
