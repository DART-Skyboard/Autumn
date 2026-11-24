const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) { console.error('FAIL: ' + msg); failed++; }
  else console.log('ok  ' + msg);
}

const css = read('css/theme-backdrops.css');
const art = read('js/autumn-theme-art.js');
const jots = read('js/jots-embed.js');

const THEMES = ['day','night','stealth','departure','ashtree','ariel','skyboard','lounge','summit','void'];
THEMES.filter(t => t !== 'void').forEach((t) => {
  ok(css.includes('body.theme-' + t + ' #theme-backdrop'), 'css body.theme-' + t);
  ok(css.includes('data-aut-atmosphere="' + t + '"'), 'css atmosphere ' + t);
  ok(css.includes('data-aut-theme="' + t + '"'), 'css first-paint ' + t);
});
ok(css.includes('data-aut-atmosphere="void"') && css.includes('body.theme-void #theme-backdrop'), 'void hides backdrop');
ok(!css.includes('data-aut-theme="system"') || !/#theme-backdrop/.test(css.split('data-aut-theme="system"')[1] || ''), 'AUTO is not hard-mapped only to DAY');

['index.html','autumn.html','autumn-dev.html'].forEach((f) => {
  const html = read(f);
  ok(html.includes('href="css/theme-backdrops.css"'), f + ' links theme-backdrops.css');
  ok(html.includes('id="theme-backdrop"'), f + ' has #theme-backdrop');
  ok(/<video id="backdrop-video"[\s\S]*?<\/video>/.test(html), f + ' keeps #backdrop-video');
  const vidTag = html.match(/<video id="backdrop-video"[\s\S]*?<\/video>/)[0];
  ok(!/\ssrc=/.test(vidTag), f + ' backdrop-video has no default src');
  ok(html.includes("data-aut-atmosphere', atm") || html.includes('data-aut-atmosphere", atm'), f + ' early atmosphere attr');
  ok(html.includes("data-aut-atmosphere', effective.key"), f + ' applyTheme sets atmosphere');
  const tStart = html.indexOf('const THEMES = [');
  const tEnd = html.indexOf('let idx =', tStart);
  const themeBlock = tStart >= 0 && tEnd > tStart ? html.slice(tStart, tEnd) : '';
  ok(themeBlock.includes('const THEMES = ['), f + ' has THEMES');
  ok(!/video:\s*'[^']+'/.test(themeBlock) && !/video:\s*"[^"]+"/.test(themeBlock), f + ' no bundled theme video URLs');
  ok((themeBlock.match(/video:\s*null/g) || []).length >= 7, f + ' every theme video is null');
});

ok(art.includes('body.aut-has-art #theme-backdrop'), 'ART CSS hides theme backdrop');
ok(art.includes('None — theme default'), 'ART panel labels the theme default');
ok(art.includes('CHOOSE IMAGE / VIDEO'), 'ART still accepts image or video');
ok(art.includes('CLEAR ART') && art.includes('function clearArt()'), 'ART can be cleared back to the default');
ok(jots.includes('#backdrop-video,#theme-backdrop{display:none!important}'), 'JOTS embed hides CSS backdrop');
ok(fs.existsSync(path.join(root, 'assets/jots-bg.mp4')), 'jots-bg.mp4 kept (still used by embed)');

if (failed) { console.error('\n' + failed + ' test(s) failed.'); process.exit(1); }
console.log('\nAll theme-backdrop tests passed.');
