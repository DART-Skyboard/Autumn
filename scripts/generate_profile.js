#!/usr/bin/env node
// generate_profile.js — runs in GitHub Actions every 15 min
// Reads live session count + lifetime_log, writes profile.svg to repo root

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const ASH_REPO = 'DART-Skyboard/leatr-ash';
const TOKEN    = process.env.LEATR_ASH_PAT || process.env.GITHUB_TOKEN;
// Repo root is one level up from scripts/
const REPO_ROOT = path.join(__dirname, '..');

function ghGet(repoPath) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: `/repos/${repoPath}`,
      headers: {
        'Authorization': `token ${TOKEN}`,
        'User-Agent': 'AutumnProfileGen/1.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    https.get(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse failed: ' + data.slice(0,200))); }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Autumn Profile SVG generator starting…');

  // 1. Read lifetime_log.json from leatr-ash
  let allTimeUsers = '—', allTimeSessions = '—';
  try {
    const logFile = await ghGet(`${ASH_REPO}/contents/ashtree/analytics/lifetime_log.json`);
    if (logFile.content) {
      const raw  = Buffer.from(logFile.content.replace(/\n/g,''), 'base64').toString();
      const log  = JSON.parse(raw);
      allTimeUsers    = String(log.totals?.all_time_unique_users ?? '—');
      allTimeSessions = String(log.totals?.all_time_sessions     ?? '—');
      console.log(`  lifetime_log: ${allTimeUsers} users, ${allTimeSessions} sessions`);
    }
  } catch(e) { console.error('  lifetime_log error:', e.message); }

  // 2. Count recently-active sessions (started within last 30 min)
  let activeSessions = 0;
  try {
    const sessions = await ghGet(`${ASH_REPO}/contents/ashtree/sessions`);
    if (Array.isArray(sessions)) {
      const now    = Date.now();
      const WINDOW = 30 * 60 * 1000; // 30 minutes
      const MIN    = 1700000000000;
      const MAX    = 1900000000000;
      activeSessions = sessions.filter(f => {
        if (!f.name.endsWith('.json') || f.name === '_index.json') return false;
        const m = f.name.match(/_t([0-9a-z]{8})/i);
        if (!m) return false;
        const ts = parseInt(m[1], 36);
        return ts > MIN && ts < MAX && (now - ts) < WINDOW;
      }).length;
      console.log(`  Active sessions (last 30 min): ${activeSessions}`);
    }
  } catch(e) { console.error('  sessions error:', e.message); }

  // 3. Read template from repo root
  const templatePath = path.join(REPO_ROOT, 'profile_template.svg');
  if (!fs.existsSync(templatePath)) {
    console.error('  ERROR: profile_template.svg not found at', templatePath);
    process.exit(1);
  }
  let svg = fs.readFileSync(templatePath, 'utf8');

  // 4. Fill in live values
  const updatedAt = new Date().toISOString().slice(0,16).replace('T',' ') + ' UTC';
  svg = svg
    .replace(/%%ACTIVE_USERS%%/g,     String(activeSessions))
    .replace(/%%ALL_TIME_USERS%%/g,    allTimeUsers)
    .replace(/%%ALL_TIME_SESSIONS%%/g, allTimeSessions)
    .replace(/%%UPDATED_AT%%/g,        updatedAt);

  // 5. Write to repo root
  const outPath = path.join(REPO_ROOT, 'profile.svg');
  fs.writeFileSync(outPath, svg);
  console.log(`✓ profile.svg written — ${activeSessions} active, ${allTimeUsers} all-time users`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
