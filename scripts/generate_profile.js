#!/usr/bin/env node
// generate_profile.js — GitHub Action version
// Uses GITHUB_TOKEN (write) for Autumn, LEATR_ASH_PAT for leatr-ash (optional)

const fs   = require('fs');
const path = require('path');
const https = require('https');

const ASH_REPO  = 'DART-Skyboard/leatr-ash';
const ASH_TOKEN = process.env.LEATR_ASH_PAT;  // must be set in Autumn repo secrets
const REPO_ROOT = path.join(__dirname, '..');

function apiGet(token, repoPath) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: `/repos/${repoPath}`,
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent':    'AutumnProfileGen/1.0',
        'Accept':        'application/vnd.github.v3+json'
      }
    };
    https.get(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: {} }); }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Autumn Profile SVG generator v4');

  let allTimeUsers = '—', allTimeSessions = '—', activeSessions = 0;

  if (ASH_TOKEN) {
    // Read lifetime_log
    try {
      const r = await apiGet(ASH_TOKEN, `${ASH_REPO}/contents/ashtree/analytics/lifetime_log.json`);
      if (r.status === 200 && r.body.content) {
        const log = JSON.parse(Buffer.from(r.body.content.replace(/\n/g,''), 'base64').toString());
        allTimeUsers    = String(log.totals?.all_time_unique_users ?? '—');
        allTimeSessions = String(log.totals?.all_time_sessions     ?? '—');
        console.log(`  analytics: ${allTimeUsers} users, ${allTimeSessions} sessions`);
      }
    } catch(e) { console.error('  analytics error:', e.message); }

    // Count active sessions
    try {
      const r = await apiGet(ASH_TOKEN, `${ASH_REPO}/contents/ashtree/sessions`);
      if (r.status === 200 && Array.isArray(r.body)) {
        const now = Date.now(), WIN = 30*60*1000, MIN = 1700000000000, MAX = 1900000000000;
        activeSessions = r.body.filter(f => {
          if (!f.name.endsWith('.json') || f.name === '_index.json') return false;
          const m = f.name.match(/_t([0-9a-z]{8})/i);
          if (!m) return false;
          const ts = parseInt(m[1], 36);
          return ts > MIN && ts < MAX && (now - ts) < WIN;
        }).length;
        console.log(`  active: ${activeSessions}`);
      }
    } catch(e) { console.error('  sessions error:', e.message); }
  } else {
    console.log('  LEATR_ASH_PAT not set — using placeholder values');
    console.log('  ⚠ Add LEATR_ASH_PAT to Autumn repo Secrets for live data');
  }

  const svg = fs.readFileSync(path.join(REPO_ROOT, 'profile_template.svg'), 'utf8')
    .replace(/%%ACTIVE_USERS%%/g,     String(activeSessions))
    .replace(/%%ALL_TIME_USERS%%/g,    allTimeUsers)
    .replace(/%%ALL_TIME_SESSIONS%%/g, allTimeSessions)
    .replace(/%%UPDATED_AT%%/g,        new Date().toISOString().slice(0,16).replace('T',' ') + ' UTC');

  fs.writeFileSync(path.join(REPO_ROOT, 'profile.svg'), svg);
  console.log(`✓ profile.svg written — ${activeSessions} active, ${allTimeUsers} users`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
