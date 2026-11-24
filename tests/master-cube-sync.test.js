// Static guards for the Admin LIVE FEED Master Maze Cube two-way sync
// (web <-> iOS Admin Console via ashtree/analytics-live/config.json).
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let failed = 0;
function check(cond, msg) { if (!cond) { console.error('FAIL: ' + msg); failed++; } }

check(html.includes('window._admMountMasterCube = function(host)'), '3D Master Maze Cube mount helper exists');
check(html.includes("cubeBox.id='adm-live-cube'"), 'LIVE FEED tab embeds the 3D cube');
check(/setInterval\(function\(\)\{\s*if\(!document\.body\.contains\(panel\)\)/.test(html), 'LIVE FEED tab polls config.json while open and stops when removed');
check(html.includes("window._autumnWriteLiveExport(newCfg, { seed:true })"), 'web-generated maze seeds latest-export.json');
check(html.includes('if (!events.length && !seed) return;'), '_autumnWriteLiveExport supports zero-event seed');
check(html.includes("generated on iOS / another session"), 'remote (iOS) maze changes are surfaced');

if (failed) { console.error(failed + ' master-cube-sync check(s) failed.'); process.exit(1); }
console.log('All master-cube-sync checks passed.');
