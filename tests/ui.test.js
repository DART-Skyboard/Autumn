const fs = require('fs');
const path = require('path');

const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let failed = 0;

// Test 1: Check if Data Policy button exists
if (!indexHtml.includes('POLICY</button>')) {
  console.error("Test 1 failed: Data Policy button not found.");
  failed++;
}

// Test 2: Check if margin was added to BRPN region
if (!indexHtml.includes('#brpn-region{height:320px;flex-shrink:0;position:relative;border-bottom:1px solid var(--border);overflow:hidden;cursor:grab;margin:10px}')) {
  console.error("Test 2 failed: #brpn-region margin not updated.");
  failed++;
}

// Test 3: Check if resizer was fixed
if (!indexHtml.includes('const nh=Math.max(100,Math.min(window.innerHeight - 100,startH+(e.clientY-startY)));')) {
  console.error("Test 3 failed: brpn-resize maximum height not updated.");
  failed++;
}

// Test 4: Check if consent modal links to autumn-privacy.html
if (!indexHtml.includes('href="autumn-privacy.html"')) {
  console.error("Test 4 failed: Consent modal does not link to full data policy.");
  failed++;
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
} else {
  console.log('All UI tests passed!');
  process.exit(0);
}
