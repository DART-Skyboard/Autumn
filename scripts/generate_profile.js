#!/usr/bin/env node
const fs   = require('fs');
const path = require('path');
const https = require('https');

const ASH_REPO    = 'DART-Skyboard/leatr-ash';
const AUTUMN_REPO = 'DART-Skyboard/Autumn';
const ASH_TOKEN   = process.env.LEATR_ASH_PAT;   // reads private leatr-ash
const WRITE_TOKEN = process.env.GITHUB_TOKEN;     // writes to Autumn (same repo, contents:write)
const REPO_ROOT   = path.join(__dirname, '..');

function apiCall(method, apiPath, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.github.com',
      path: apiPath,
      method,
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'AutumnProfileGen/1.0',
        'Accept': 'application/vnd.github.v3+json',
        ...(data ? {'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)} : {})
      }
    };
    const req = https.request(opts, res => {
      let out = '';
      res.on('data', d => out += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(out) }); }
        catch(e) { resolve({ status: res.statusCode, body: out }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Autumn Profile SVG generator starting…');
  let allTimeUsers = '—', allTimeSessions = '—', activeSessions = 0;

  if (ASH_TOKEN) {
    try {
      const r = await apiCall('GET', `/repos/${ASH_REPO}/contents/ashtree/analytics/lifetime_log.json`, ASH_TOKEN);
      if (r.status === 200 && r.body.content) {
        const log = JSON.parse(Buffer.from(r.body.content.replace(/\n/g,''), 'base64').toString());
        allTimeUsers    = String(log.totals?.all_time_unique_users ?? '—');
        allTimeSessions = String(log.totals?.all_time_sessions     ?? '—');
        console.log(`  analytics: ${allTimeUsers} users, ${allTimeSessions} sessions`);
      }
    } catch(e) { console.error('  analytics error:', e.message); }

    try {
      const r = await apiCall('GET', `/repos/${ASH_REPO}/contents/ashtree/sessions`, ASH_TOKEN);
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
    console.log('  LEATR_ASH_PAT not set — add it to Autumn repo Secrets for live data');
  }

  const svg = fs.readFileSync(path.join(REPO_ROOT, 'profile_template.svg'), 'utf8')
    .replace(/%%ACTIVE_USERS%%/g,     String(activeSessions))
    .replace(/%%ALL_TIME_USERS%%/g,    allTimeUsers)
    .replace(/%%ALL_TIME_SESSIONS%%/g, allTimeSessions)
    .replace(/%%UPDATED_AT%%/g,        new Date().toISOString().slice(0,16).replace('T',' ') + ' UTC');

  const content64 = Buffer.from(svg).toString('base64');

  // Get current SHA for update
  let sha = null;
  const existing = await apiCall('GET', `/repos/${AUTUMN_REPO}/contents/profile.svg`, WRITE_TOKEN);
  if (existing.status === 200) sha = existing.body.sha;

  // Commit via API using GITHUB_TOKEN (contents:write permission set in workflow)
  const body = {
    message: `profile: update user count ${new Date().toISOString().slice(0,16)} UTC`,
    content: content64
  };
  if (sha) body.sha = sha;

  const result = await apiCall('PUT', `/repos/${AUTUMN_REPO}/contents/profile.svg`, WRITE_TOKEN, body);
  if (result.status === 200 || result.status === 201) {
    console.log(`✓ profile.svg committed — ${activeSessions} active, ${allTimeUsers} all-time`);
  } else {
    console.error(`✗ commit failed: ${result.status}`, JSON.stringify(result.body).slice(0,300));
    process.exit(1);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
