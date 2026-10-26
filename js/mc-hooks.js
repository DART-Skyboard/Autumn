/* ════════════════════════════════════════════════════════════════
   MOVEMENT CONJECTURE — CONDITIONS + 3D + PDF WIRING
   Wraps the existing algorithm (runAll / projectTrajectory / charts) without
   changing its math. The original power-series projection is untouched; the
   conditions decide which projected steps are kept (see mc-conditions.js).
════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const MCS = window.MCS = {on:true, strict:false, hist:{}, cond:{}, histErr:{}, busy:false};
const $ = id => document.getElementById(id);
const pct = x => (x==null||isNaN(x)) ? '—' : Math.round(x*100)+'%';

/* ── daily history (5y) — same endpoint order the quote fetch uses ── */
async function fetchHistory(ticker){
  const t = encodeURIComponent(ticker.trim().toUpperCase());
  const y = `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=5y`;
  const urls = [y, y.replace('query1','query2'),
    'https://corsproxy.io/?'+encodeURIComponent(y),
    'https://api.allorigins.win/raw?url='+encodeURIComponent(y),
    'https://api.codetabs.com/v1/proxy?quest='+encodeURIComponent(y),
    'https://corsproxy.io/?'+encodeURIComponent(y.replace('query1','query2').replace('range=5y','range=2y'))];
  const ck='mc_hist_'+t;
  for(const u of urls){
    try{
      const r = await fetch(u,{signal:AbortSignal.timeout(12000)}); if(!r.ok) continue;
      const d = await r.json(); const res = d && d.chart && d.chart.result && d.chart.result[0]; if(!res) continue;
      const ts = res.timestamp||[], cl = (res.indicators.quote[0]||{}).close||[];
      const rows = []; ts.forEach((s,i)=>{ if(cl[i]>0) rows.push({d:new Date(s*1000).toISOString().slice(0,10), c:cl[i]}); });
      if(rows.length>=20){ try{ localStorage.setItem(ck,JSON.stringify({at:Date.now(),rows})); }catch(e){} return rows; }
    }catch(e){}
  }
  try{ const c=JSON.parse(localStorage.getItem(ck)||'null'); if(c&&c.rows&&c.rows.length>=20) return c.rows; }catch(e){}
  throw new Error('history unavailable');
}
MCS.fetchHistory = fetchHistory;

/* ── patch projection: conditions refine each projected step ── */
const _projectTrajectory = window.projectTrajectory;
window.projectTrajectory = function(result, a, b){
  const base = _projectTrajectory(result, a, b);
  const sl = slots.find(s=>s.result===result);
  result._base = base;
  if(!sl || !MCS.on){ result._ref = null; return base; }
  const rf = MCC.refineTrajectory(base, MCS.cond[sl.ticker], {hillStrict:MCS.strict});
  result._ref = rf; return rf.pts;
};
// original (grey) series stays visible in 2D when conditions are on
const _drawTrajectory = window.drawTrajectory;
window.drawTrajectory = function(stocks, yrS, yrE){
  _drawTrajectory(stocks, yrS, yrE);
  if(!MCS.on) return;
  const canvas = $('chart-trajectory'); if(!canvas) return;
  const ctx = canvas.getContext('2d'), W=canvas.width;
  ctx.save(); ctx.font="9px 'Share Tech Mono'"; ctx.fillStyle='rgba(57,255,130,.8)';
  const q = stocks.map(s=>s.result._ref?`${s.ticker||'—'} ${s.result._ref.qualified}/${s.result._ref.total}`:'').filter(Boolean).join('   ');
  ctx.textAlign='right'; ctx.fillText('QUALIFIED YEARS  '+q, W-14, 18); ctx.restore();
};
// keep the 3D phase graph in step with tangent edits
const _prAll = window._phaseRenderAll; let _t3=0;
window._phaseRenderAll = function(){ _prAll(); clearTimeout(_t3); _t3=setTimeout(()=>{ const m=MC3D.mounts.phase; if(m&&m.on) m.rebuild(); },120); };

/* ── run hook ── */
const _runAll = window.runAll;
window.runAll = function(){ _runAll(); afterRun(); };
const _resetAll = window.resetAll;
window.resetAll = function(){ _resetAll(); const c=$('cond-body'); if(c) c.innerHTML=''; };

async function afterRun(){
  const active = slots.filter(s=>s.result); if(!active.length) return;
  MCS.busy = true; paintCard(active, true); try{ MC3D.refresh(); }catch(e){}
  await Promise.all(active.map(async sl=>{
    if(!sl.ticker || MCS.hist[sl.ticker]) return;
    try{ MCS.hist[sl.ticker] = await fetchHistory(sl.ticker); delete MCS.histErr[sl.ticker]; }
    catch(e){ MCS.histErr[sl.ticker] = true; }
  }));
  MCS.busy = false; recompute();
}
function recompute(){
  const active = slots.filter(s=>s.result); if(!active.length) return;
  active.forEach(sl=>{ const h = MCS.hist[sl.ticker]; MCS.cond[sl.ticker] = h ? MCC.analyze(h,{hillStrict:MCS.strict}) : null; });
  redraw(active);
}
function redraw(active){
  const yrS=parseInt($('yr-start').value), yrE=parseInt($('yr-end').value);
  drawTrajectory(active,yrS,yrE); paintCard(active,false); MC3D.refresh();
  if(window.MCS_laneSel) MCS_laneSel(active);
}
MCS.recompute = recompute;
MCS.redrawAll = function(){
  const a = slots.filter(s=>s.result); if(!a.length) return;
  const yrS=parseInt($('yr-start').value), yrE=parseInt($('yr-end').value);
  try{ drawTrajectory(a,yrS,yrE); drawGeo(a); window._phaseRenderAll(); }catch(e){ console.warn(e); }
};
MCS.retry = function(){ Object.keys(MCS.histErr).forEach(k=>delete MCS.histErr[k]); afterRun(); };

/* ── conditions card ── */
const CHIP = (ok,txt)=>`<span style="display:inline-block;margin:1px 3px 1px 0;padding:1px 7px;border-radius:9px;font-family:var(--fc);font-size:.46rem;border:1px solid ${ok?'rgba(57,255,130,.5)':'rgba(255,64,96,.45)'};color:${ok?'#39ff82':'#ff6b86'};background:${ok?'rgba(57,255,130,.08)':'rgba(255,64,96,.07)'}">${txt}</span>`;
const BTN = "font-family:var(--fh);font-size:.36rem;letter-spacing:1.5px;padding:5px 11px;border-radius:4px;cursor:pointer;border:1px solid rgba(0,229,255,.3);background:rgba(0,229,255,.07);color:var(--cyan)";
function injectCard(){
  if($('cond-card')) return;
  const anchor = $('cmp-table'); if(!anchor) return;
  anchor.closest('.card').insertAdjacentHTML('beforebegin', `
  <div class="card" id="cond-card" style="border-color:rgba(57,255,130,.25)">
    <div class="card-title" style="flex-wrap:wrap">RIDE · BULGE · DIVERGE CONDITIONS
      <span style="flex:1"></span>
      <button style="${BTN}" id="cond-on" onclick="MCS_toggle('on')">CONDITIONS: ON</button>
      <button style="${BTN}" id="cond-strict" onclick="MCS_toggle('strict')" title="Also require a hill-shaped (arched or straight) path, not a bowl">HILL STRICT: OFF</button>
      <button style="${BTN}" onclick="MCPDF.save()">⬇ PDF REPORT</button>
      <button style="${BTN}" onclick="MCPDF.print()">🖨 PRINT</button>
    </div>
    <div style="font-family:var(--fc);font-size:.5rem;color:var(--dim);line-height:1.9;margin-bottom:12px">
      <b style="color:var(--cyan)">DAY</b> rides high / even / low — all allowed &nbsp;·&nbsp;
      <b style="color:var(--cyan)">WEEK</b> bulge positive, diverge &gt; every day &nbsp;·&nbsp;
      <b style="color:var(--cyan)">MONTH</b> bulge positive in days and weeks, diverge &gt; every week &nbsp;·&nbsp;
      <b style="color:var(--cyan)">YEAR</b> bulge positive in months, diverge &gt; every month &nbsp;·&nbsp;
      <b style="color:var(--cyan)">YEARS</b> accumulation bulges positive.
      Projected years that do not bulge positive are held flat; kept years are scaled by the stock's history gate.
    </div>
    <div style="overflow-x:auto"><div id="cond-body"></div></div>
    <div class="card-title" id="cond-lanes-title" style="margin-top:18px">3D CONDITION TERRAIN
      <select id="cond-lanes-stock" style="background:#04192a;color:var(--cyan);border:1px solid var(--bdr2);border-radius:4px;font-family:var(--fc);font-size:.5rem;padding:3px 6px"></select></div>
    <div id="cond-lanes-ph" class="chart-wrap" style="display:none"></div>
  </div>`);
  MC3D.mount('lanes', $('cond-lanes-ph'), $('cond-lanes-title'), ()=>{
    const sl = slots.find(s=>s.ticker===$('cond-lanes-stock').value && s.result); const c = sl && MCS.cond[sl.ticker];
    if(c && c.ok) return [c, sl.color];
    const r = sl && sl.result._ref;                       // no market history: show the projected years instead
    if(!r || !r.flags.length) return null;
    const years = r.flags.slice(1).map(f=>({diverge:f.q, bulgeOK:f.ok}));
    return [{ok:true,days:[],weeks:[],months:[],years}, sl.color, 'projected years only'];
  });
  $('cond-lanes-stock').onchange = ()=>{ const m=MC3D.mounts.lanes; if(m) m.rebuild(); };
}
window.MCS_laneSel = function(active){
  const s=$('cond-lanes-stock'); if(!s) return; const keep=s.value;
  s.innerHTML = active.filter(a=>a.ticker).map(a=>`<option value="${a.ticker}">${a.ticker}</option>`).join('');
  if(keep && [...s.options].some(o=>o.value===keep)) s.value=keep;
  const m=MC3D.mounts.lanes; if(m) m.rebuild();
};
window.MCS_toggle = function(k){
  MCS[k] = !MCS[k];
  $('cond-on').textContent = 'CONDITIONS: '+(MCS.on?'ON':'OFF');
  $('cond-strict').textContent = 'HILL STRICT: '+(MCS.strict?'ON':'OFF');
  recompute();
};
function paintCard(active, loading){
  injectCard(); const body=$('cond-body'); if(!body) return;
  if(loading){ body.innerHTML='<div style="font-family:var(--fc);font-size:.55rem;color:var(--cyan)">⟳ reading day · week · month · year history…</div>'; }
  const rows = active.map(sl=>{
    const c = MCS.cond[sl.ticker], r=sl.result._ref;
    if(!sl.ticker) return `<tr><td style="color:${sl.color}">—</td><td colspan="9" style="color:var(--dim)">no ticker: projection conditions only (history gate = 100%)</td><td>${r?r.qualified+'/'+r.total:'—'}</td></tr>`;
    if(!c || !c.ok) return `<tr><td style="color:${sl.color};font-weight:700">${sl.ticker}</td><td colspan="9" style="color:#ff9fb0">${MCS.histErr[sl.ticker]?'history unavailable — gate neutral (100%) · <a href="#" style="color:var(--cyan)" onclick="MCS.retry();return false">retry</a>':(loading?'…':(c&&c.reason)||'—')}</td><td>${r?r.qualified+'/'+r.total:'—'}</td></tr>`;
    const k=c.rates, cur=c.current;
    return `<tr><td style="color:${sl.color};font-weight:700">${sl.ticker}</td>
      <td>${c.nDays}</td>
      <td>${CHIP(1,'↑'+c.rideCount.high)}${CHIP(1,'＝'+c.rideCount.even)}${CHIP(1,'↓'+c.rideCount.low)}</td>
      <td>${pct(k.weekBulge)}</td><td>${pct(k.weekDiverge)}</td>
      <td>${pct(k.monthBulge)}</td><td>${pct(k.monthDiverge)}</td>
      <td>${pct(k.yearBulge)} / ${pct(k.yearDiverge)}</td>
      <td>${CHIP(cur.week.bulgeOK,'W')}${CHIP(cur.month.bulgeOK,'M')}${CHIP(cur.year.bulgeOK,'Y')}${CHIP(cur.accumulated.bulgeOK,'Σ')}</td>
      <td style="color:var(--gold);font-weight:700">${pct(c.gate)}</td>
      <td style="color:#39ff82">${r?r.qualified+'/'+r.total:'—'}</td></tr>`;
  }).join('');
  body.innerHTML = `<table class="stbl"><thead><tr><th>TICKER</th><th>DAYS</th><th>RIDES</th><th>WEEK BULGE</th><th>WEEK DIV</th><th>MONTH BULGE</th><th>MONTH DIV</th><th>YEAR B / D</th><th>NOW</th><th>GATE</th><th>YEARS KEPT</th></tr></thead><tbody>${rows}</tbody></table>
  <div style="font-family:var(--fc);font-size:.42rem;color:var(--dim);margin-top:6px">Rates cover the last 26 weeks, 12 months and all full years. NOW = most recent completed week / month / year and the multi-year accumulation (Σ).</div>`;
  MCS_laneSel(active);
}

/* ── mount 3D switches on the three existing charts ── */
function mountAll(){
  const tw=$('chart-trajectory').parentNode, gw=$('chart-geo').parentNode, pw=$('chart-phase').parentNode;
  const act=()=>slots.filter(s=>s.result);
  const yrs=()=>[parseInt($('yr-start').value),parseInt($('yr-end').value)];
  MC3D.mount('trajectory',tw,tw.parentNode.querySelector('.card-title'),()=>act().length?[act(),...yrs()]:null);
  MC3D.mount('geo',gw,gw.parentNode.querySelector('.card-title'),()=>act().length?[act()]:null);
  MC3D.mount('phase',pw,$('phase-card').querySelector('.card-title'),()=>act().length?[act(),...yrs()]:null);
  // report buttons in the results header
  const sh=document.querySelector('#sec-results .sh');
  if(sh && !$('mc-report-btns')){
    const d=document.createElement('span'); d.id='mc-report-btns'; d.style.cssText='display:inline-flex;gap:6px;margin-left:10px';
    d.innerHTML=`<button style="${BTN}" onclick="MCPDF.save()">⬇ PDF REPORT</button><button style="${BTN}" onclick="MCPDF.print()">🖨 PRINT</button>`;
    sh.appendChild(d);
  }
  injectCard();
}
mountAll();
})();
