const fs = require('fs');
const path = require('path');

// Leaked-prefix fingerprint only — not a live token. Contiguous OR split-join
// reconstitutions (e.g. 'ghp_' + 'IsnQDc') must fail.
const PREFIX = 'ghp_IsnQDc';

const shells = ['index.html', 'autumn.html', 'autumn-dev.html'];

let failed = 0;

function compactJs(src) {
  // Strip string/concat punctuation so split-join and .join([]) tokens rejoin
  return src.replace(/['"`+\s\\,\[\]]/g, '');
}

function isPlaceholderBody(body) {
  return /^x+$/i.test(body) || /^(your|token|here)+$/i.test(body);
}

function hasLivePatShape(src) {
  // Classic ghp_ is 36 alnum chars; ignore obvious placeholders like ghp_xxxx...
  var m;
  var re = /ghp_([A-Za-z0-9]{36})/g;
  while ((m = re.exec(src))) {
    if (!isPlaceholderBody(m[1])) return true;
  }
  re = /github_pat_([A-Za-z0-9_]{20,})/g;
  while ((m = re.exec(src))) {
    if (!isPlaceholderBody(m[1])) return true;
  }
  return false;
}

function hasSplitJoinToken(src) {
  // 'ghp_' + '…'  /  "github_pat_" + "…"  /  ['ghp_', '…'].join
  return /['"`]ghp_['"`]\s*\+/.test(src) ||
         /['"`]github_pat_['"`]\s*\+/.test(src) ||
         /\[[^\]]*(['"`]ghp_['"`]|['"`]github_pat_['"`])[^\]]*\]\s*\.join/.test(src);
}

// Harness: split-join of the fingerprint must be detected (no live token here)
var splitJoinSample = "'" + PREFIX.slice(0, 4) + "' + '" + PREFIX.slice(4) + "'";
if (!compactJs(splitJoinSample).includes(PREFIX) || !hasSplitJoinToken(splitJoinSample)) {
  console.error('Test harness failed: split-join compaction did not reconstitute prefix.');
  failed++;
}

for (const file of shells) {
  const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const compact = compactJs(html);

  if (html.includes(PREFIX) || compact.includes(PREFIX)) {
    console.error('Test failed: Hardcoded GitHub PAT prefix found in ' + file + '.');
    failed++;
  }

  if (hasLivePatShape(html) || hasLivePatShape(compact)) {
    console.error('Test failed: GitHub PAT-shaped secret found in ' + file + '.');
    failed++;
  }

  if (hasSplitJoinToken(html)) {
    console.error('Test failed: Split-join GitHub PAT construction found in ' + file + '.');
    failed++;
  }
}

if (failed > 0) {
  process.exit(1);
} else {
  console.log('Security check passed: No hardcoded PATs found.');
  process.exit(0);
}
