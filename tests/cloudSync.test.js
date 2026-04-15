const fs = require('fs');
const path = require('path');

const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let failed = 0;

if (!indexHtml.includes("writeLeatrAshMemory('ashbranches/'")) {
  console.error("Test failed: ashbranches directory not used for branch logging.");
  failed++;
}

if (!indexHtml.includes("writeLeatrAshMemory('ashleaves/'")) {
  console.error("Test failed: ashleaves directory not used for leaf logging.");
  failed++;
}

if (!indexHtml.includes("writeLeatrAshMemory('ashtree/master_memory.json'")) {
  console.error("Test failed: ashtree directory not used for master memory logging.");
  failed++;
}

if (failed > 0) {
  process.exit(1);
} else {
  console.log('Cloud Sync architecture paths are correct.');
  process.exit(0);
}
