/* ════════════════════════════════════════════════════════════════
   MOVEMENT CONJECTURE — RIDE / BULGE / DIVERGE CONDITIONS
   © DART Meadow LLC · Radical Deepscale
   Pure math (no DOM). Loaded before mc-hooks.js; also runs in Node for tests.

   Rules (from the Movement Conjecture notes):
     Day    : RIDE   = high (+), even (0) or low (−)           — all allowed
     Week   : BULGE  = path of the days' rides forms a positive hill
              DIVERGE= week's net divergence  > each day's divergence in that week
     Month  : BULGE  = positive in the days' path AND the weeks' path
              DIVERGE= month > each week's divergence in that month
     Year   : BULGE  = positive in the months' path
              DIVERGE= year  > each month's divergence in that year
     Years  : accumulation of the yearly divergences must also bulge positive
   "Divergence" is the net slope over the period (sum of child divergences),
   "bulge" is the area of the cumulative path above its starting level.
════════════════════════════════════════════════════════════════ */
(function(root){
'use strict';
const EVEN_TOL = 0.0005;           // |daily move| below 0.05 % counts as "even"

const sum  = a => a.reduce((s,x)=>s+x,0);
const mean = a => a.length ? sum(a)/a.length : 0;
function cum(a){ let s=0; return a.map(x=>(s+=x)); }

/* bulge of a series of child divergences:
   area  = mean height of the cumulative path above its start (must be > 0)
   arch  = mean height of the path above the straight chord start→end
           (>= 0 means hill-shaped / steady; < 0 means it sags like a bowl) */
function bulgeOf(children){
  const n = children.length;
  if(!n) return {area:0, arch:0, ok:false, hill:false};
  const path = cum(children), net = path[n-1];
  const area = mean(path);
  const arch = mean(path.map((p,k)=>p - net*(k+1)/n));
  return {area, arch, ok: area > 0, hill: area > 0 && arch >= -1e-12};
}

/* ── calendar keys ─────────────────────────────────────────────── */
function isoWeekKey(ds){
  const d = new Date(ds+'T00:00:00Z');
  const day = (d.getUTCDay()+6)%7;                 // Mon=0
  d.setUTCDate(d.getUTCDate()-day+3);              // Thursday of this week
  const y = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(y,0,4));
  const wk = 1 + Math.round(((d - jan4)/864e5 - 3 + ((jan4.getUTCDay()+6)%7))/7);
  return y+'-W'+String(wk).padStart(2,'0');
}
const monthKey = ds => ds.slice(0,7);
const yearKey  = ds => ds.slice(0,4);

function groupBy(arr, keyFn){
  const out = []; let cur = null;
  for(const it of arr){
    const k = keyFn(it);
    if(!cur || cur.key !== k){ cur = {key:k, items:[]}; out.push(cur); }
    cur.items.push(it);
  }
  return out;
}

/* ── main analysis ─────────────────────────────────────────────
   rows: [{d:'YYYY-MM-DD', c:close}, …] ascending.                */
function analyze(rows, opts){
  opts = opts || {};
  const strict = !!opts.hillStrict;
  const tol = opts.evenTol != null ? opts.evenTol : EVEN_TOL;
  rows = (rows||[]).filter(r=>r && r.c>0 && r.d).sort((a,b)=>a.d<b.d?-1:1);
  if(rows.length < 6) return {ok:false, reason:'not enough history', days:rows.length};

  // DAYS — ride high / even / low
  const days = [];
  for(let i=1;i<rows.length;i++){
    const r = Math.log(rows[i].c/rows[i-1].c);
    days.push({d:rows[i].d, diverge:r, ride: r>tol?'high':(r<-tol?'low':'even')});
  }
  const rideCount = {high:0, even:0, low:0};
  days.forEach(x=>rideCount[x.ride]++);

  const pass = (b)=> strict ? b.hill : b.ok;

  // WEEKS — bulge of days' path; diverge > each day
  const weeks = groupBy(days, x=>isoWeekKey(x.d)).map(g=>{
    const ch = g.items.map(x=>x.diverge);
    const diverge = sum(ch), b = bulgeOf(ch);
    return {key:g.key, n:ch.length, diverge, bulge:b,
      bulgeOK: pass(b), divergeOK: diverge > Math.max(...ch), days:g.items, partial:false};
  });
  // MONTHS — bulge in days' path AND weeks' path; diverge > each week
  const wkByMonth = {};
  weeks.forEach(w=>{ const mk = monthKey(w.days[w.days.length-1].d); (wkByMonth[mk]=wkByMonth[mk]||[]).push(w); });
  const months = groupBy(days, x=>monthKey(x.d)).map(g=>{
    const dch = g.items.map(x=>x.diverge);
    const wch = (wkByMonth[g.key]||[]).map(w=>w.diverge);
    const diverge = sum(dch), bd = bulgeOf(dch), bw = bulgeOf(wch);
    return {key:g.key, n:dch.length, diverge, bulge:{area:bd.area, arch:bd.arch, weekArea:bw.area},
      bulgeOK: pass(bd) && (wch.length<2 || pass(bw)),
      divergeOK: wch.length ? diverge > Math.max(...wch) : false,
      weeks:wkByMonth[g.key]||[], days:g.items};
  });
  // YEARS — bulge in months' path; diverge > each month
  const moByYear = {};
  months.forEach(m=>{ (moByYear[m.key.slice(0,4)] = moByYear[m.key.slice(0,4)]||[]).push(m); });
  const years = Object.keys(moByYear).sort().map(k=>{
    const mch = moByYear[k].map(m=>m.diverge);
    const diverge = sum(mch), b = bulgeOf(mch);
    return {key:k, n:mch.length, diverge, bulge:b, bulgeOK:pass(b),
      divergeOK: mch.length>1 ? diverge > Math.max(...mch) : false, months:moByYear[k]};
  });
  // mark the in-progress (incomplete) tail periods
  const lastDay = days[days.length-1].d;
  if(weeks.length)  weeks[weeks.length-1].partial   = weeks[weeks.length-1].n < 5;
  if(months.length) months[months.length-1].partial = months[months.length-1].n < 15 && lastDay.slice(8)<'28';
  if(years.length)  years[years.length-1].partial   = years[years.length-1].n < 12;

  // YEARS ACCUMULATED — path of the yearly divergences
  const accum = bulgeOf(years.map(y=>y.diverge));

  const rate = (arr,f)=> arr.length ? arr.filter(f).length/arr.length : 0;
  const recentW = weeks.slice(-26), recentM = months.slice(-12);
  const rates = {
    weekBulge:rate(recentW,w=>w.bulgeOK), weekDiverge:rate(recentW,w=>w.divergeOK),
    monthBulge:rate(recentM,m=>m.bulgeOK), monthDiverge:rate(recentM,m=>m.divergeOK),
    yearBulge:rate(years,y=>y.bulgeOK), yearDiverge:rate(years,y=>y.divergeOK)
  };
  const gate = mean(Object.values(rates));
  const lastOf = (a)=> { const c=a.filter(x=>!x.partial); return c.length?c[c.length-1]:a[a.length-1]; };
  const cw = lastOf(weeks), cm = lastOf(months), cy = lastOf(years);
  const current = {
    week:{key:cw.key, bulgeOK:cw.bulgeOK, divergeOK:cw.divergeOK},
    month:{key:cm.key, bulgeOK:cm.bulgeOK, divergeOK:cm.divergeOK},
    year:{key:cy.key, bulgeOK:cy.bulgeOK, divergeOK:cy.divergeOK},
    accumulated:{bulgeOK:accum.ok}
  };
  const qualifiedNow = cw.bulgeOK && cm.bulgeOK && cy.bulgeOK && accum.ok;
  return {ok:true, days, weeks, months, years, rideCount, rates, gate, accum, current, qualifiedNow,
          strict, nDays:days.length, from:rows[0].d, to:rows[rows.length-1].d};
}

/* ── apply the conditions to a projected trajectory ─────────────
   base: [{year,val}] from projectTrajectory(). Each projected year step
   is a "year" whose bulge is read over the trailing accumulation window;
   steps that do not bulge positive (or whose divergence is not positive
   and above its own monthly share) are held flat, qualified steps keep the
   original propagation scaled by the history gate.                      */
function refineTrajectory(base, cond, opts){
  opts = opts || {};
  const win = opts.window || 5, strict = !!opts.hillStrict;
  const g = (cond && cond.ok) ? cond.gate : 1;
  const n = base.length;
  const out = [], flags = [];
  if(!n) return {pts:out, flags, qualified:0, total:0};
  // relative (scale-free) year divergences
  const q = [0];
  for(let i=1;i<n;i++){
    const prev = Math.abs(base[i-1].val) || 1e-300;
    q.push((base[i].val - base[i-1].val)/prev);
  }
  let v = base[0].val; out.push({year:base[0].year, val:v}); flags.push({ok:true, ride:'even', q:0});
  let qualified = 0;
  for(let i=1;i<n;i++){
    const lo = Math.max(1, i-win+1);
    const w = q.slice(lo, i+1);
    const b = bulgeOf(w);                       // accumulation of the trailing years
    const monthly = q[i]/12;                    // projected year split evenly into 12 months
    const divOK = q[i] > 0 && q[i] > monthly;   // year diverge > each month's diverge
    const ok = (strict ? b.hill : b.ok) && divOK;
    const ride = q[i] > EVEN_TOL ? 'high' : (q[i] < -EVEN_TOL ? 'low' : 'even');
    if(ok){ v += (base[i].val - base[i-1].val) * g; qualified++; }
    out.push({year:base[i].year, val:v});
    flags.push({ok, ride, q:q[i], bulge:b});
  }
  return {pts:out, flags, qualified, total:n-1, gate:g};
}

const API = {EVEN_TOL, bulgeOf, analyze, refineTrajectory, isoWeekKey, monthKey, yearKey};
if(typeof module !== 'undefined' && module.exports) module.exports = API;
root.MCC = API;
})(typeof window !== 'undefined' ? window : globalThis);
