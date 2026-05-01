#!/usr/bin/env node
// generate_profile.js
// Reads live session data from leatr-ash, generates profile.svg,
// commits it directly to Autumn repo via GitHub API (no git push needed)

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const ASH_REPO    = 'DART-Skyboard/leatr-ash';
const AUTUMN_REPO = 'DART-Skyboard/Autumn';
const TOKEN       = process.env.LEATR_ASH_PAT || process.env.GITHUB_TOKEN;
const REPO_ROOT   = path.join(__dirname, '..');

function apiRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.github.com',
      path: apiPath,
      method,
      headers: {
        'Authorization': `token ${TOKEN}`,
        'User-Agent':    'AutumnProfileGen/1.0',
        'Accept':        'application/vnd.github.v3+json',
        'Content-Type':  'application/json'
      }
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
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
  console.log('Autumn Profile SVG generator v3 starting…');

  // 1. Read lifetime_log.json
  let allTimeUsers = '—', allTimeSessions = '—';
  try {
    const r = await apiRequest('GET', `/repos/${ASH_REPO}/contents/ashtree/analytics/lifetime_log.json`);
    if (r.status === 200 && r.body.content) {
      const log = JSON.parse(Buffer.from(r.body.content.replace(/\n/g,''), 'base64').toString());
      allTimeUsers    = String(log.totals?.all_time_unique_users ?? '—');
      allTimeSessions = String(log.totals?.all_time_sessions     ?? '—');
      console.log(`  analytics: ${allTimeUsers} users, ${allTimeSessions} sessions`);
    } else { console.log(`  analytics fetch: HTTP ${r.status}`); }
  } catch(e) { console.error('  analytics error:', e.message); }

  // 2. Count recently-active sessions (last 30 min)
  let activeSessions = 0;
  try {
    const r = await apiRequest('GET', `/repos/${ASH_REPO}/contents/ashtree/sessions`);
    if (r.status === 200 && Array.isArray(r.body)) {
      const now = Date.now(), WIN = 30*60*1000, MIN = 1700000000000, MAX = 1900000000000;
      activeSessions = r.body.filter(f => {
        if (!f.name.endsWith('.json') || f.name === '_index.json') return false;
        const m = f.name.match(/_t([0-9a-z]{8})/i);
        if (!m) return false;
        const ts = parseInt(m[1], 36);
        return ts > MIN && ts < MAX && (now - ts) < WIN;
      }).length;
      console.log(`  active sessions: ${activeSessions}`);
    }
  } catch(e) { console.error('  sessions error:', e.message); }

  // 3. Fill template
  const templatePath = path.join(REPO_ROOT, 'profile_template.svg');
  let svg = fs.readFileSync(templatePath, 'utf8');
  const updatedAt = new Date().toISOString().slice(0,16).replace('T',' ') + ' UTC';
  svg = svg
    .replace(/%%ACTIVE_USERS%%/g,     String(activeSessions))
    .replace(/%%ALL_TIME_USERS%%/g,    allTimeUsers)
    .replace(/%%ALL_TIME_SESSIONS%%/g, allTimeSessions)
    .replace(/%%UPDATED_AT%%/g,        updatedAt);

  // 4. Commit via GitHub API (no git push required)
  const content64 = Buffer.from(svg).toString('base64');
  // Get current SHA of profile.svg
  let currentSha = null;
  try {
    const r = await apiRequest('GET', `/repos/${AUTUMN_REPO}/contents/profile.svg`);
    if (r.status === 200) currentSha = r.body.sha;
  } catch(e) {}

  // Skip if content is identical
  const body = {
    message: `profile: update live user count ${updatedAt}`,
    content: content64
  };
  if (currentSha) body.sha = currentSha;

  const r2 = await apiRequest('PUT', `/repos/${AUTUMN_REPO}/contents/profile.svg`, body);
  if (r2.status === 200 || r2.status === 201) {
    console.log(`✓ profile.svg committed via API — ${activeSessions} active, ${allTimeUsers} all-time`);
  } else {
    console.error(`✗ API commit failed: ${r2.status}`, JSON.stringify(r2.body).slice(0,200));
    process.exit(1);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
