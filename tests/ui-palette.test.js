// Static checks for the UI SHADING palette controls (js/autumn-theme-art.js). Run: node tests/ui-palette.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const art = fs.readFileSync(path.join(__dirname, '..', 'js', 'autumn-theme-art.js'), 'utf8');
let failed = 0;
function ok(cond, msg) { if (!cond) { console.error('FAIL: ' + msg); failed++; } else console.log('ok  ' + msg); }

new vm.Script(art); ok(true, 'autumn-theme-art.js parses');
['data-uipick', 'surface', 'surface2', 'button2', 'glow', 'border', 'aut-pe-opacity', 'aut-pe-blur', 'aut-pe-angle', 'data-uistyle', 'data-uidir', 'data-uion']
  .forEach((k) => ok(art.includes(k), 'editor control ' + k));
['--aut-ui-surface-fill', '--aut-ui-btn-fill', '--aut-ui-btn-fill-hi', '--aut-ui-glow-a', '--aut-ui-blur', '--aut-ui-input', '--aut-ui-bubble-fill']
  .forEach((v) => ok(art.includes(v), 'css var ' + v));
['header', '.msg.user .bubble', '.msg.autumn .bubble', '.modal-box', '#input-area', '.hdr-btn', '.bmh-btn', '.ac-tool-btn']
  .forEach((sel) => ok(art.includes('body.aut-ui-custom ' + sel), 'wired selector ' + sel));
ok(/opacity: clampN\(u\.opacity, 15, 100/.test(art), 'opacity clamped 15–100');
ok(/if \(!d\.ui && d\.id\) ui\.on = false/.test(art), 'legacy palettes start at THEME DEFAULT');
ok(/function saveCustom\(name, bg1, bg2, accent, id, ui\)/.test(art), 'saveCustom persists ui');
if (failed) { console.error(failed + ' failed'); process.exit(1); }
console.log('all passed');
