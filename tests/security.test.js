const fs = require('fs');
const path = require('path');

const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let failed = 0;

if (indexHtml.includes('ghp_IsnQDc')) {
  console.error("Test failed: Hardcoded GitHub PAT found in index.html.");
  failed++;
}

if (failed > 0) {
  process.exit(1);
} else {
  console.log('Security check passed: No hardcoded PATs found.');
  process.exit(0);
}
