/* ════════════════════════════════════════════════════════════════
   MOVEMENT CONJECTURE — PDF REPORT (jsPDF + autoTable)
   Formal report: results, calculation trace, 2D and 3D charts,
   conditions, methodology. SAVE downloads, PRINT opens the print view.
════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const $ = id => document.getElementById(id);
const NAVY=[1,8,14], PAGE=[3,17,28], CYAN=[0,229,255], INK=[204,232,240], GREY=[120,160,172], LINE=[16,70,90], CELL=[5,28,46], CELL2=[7,38,60], HEAD=[0,52,72];
const hexRGB = h => [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));

function img2d(id){
  const c=$(id); if(!c||!c.width||!c.height) return null;
  const o=document.createElement('canvas'); o.width=c.width; o.height=c.height;
  const g=o.getContext('2d'); g.fillStyle='#020c14'; g.fillRect(0,0,o.width,o.height); g.drawImage(c,0,0);
  return {url:o.toDataURL('image/jpeg',0.86),w:o.width,h:o.height};
}
function nf(v,d){ return (typeof fmt==='function') ? fmt(v,d||4) : String(v); }

async function build(){
  const jsPDF = window.jspdf && window.jspdf.jsPDF;
  if(!jsPDF){ throw new Error('PDF library not loaded (check connection)'); }
  const active = slots.filter(s=>s.result);
  if(!active.length) throw new Error('Run COMPUTE CONJECTURE first');
  const yrS=parseInt($('yr-start').value), yrE=parseInt($('yr-end').value), eod=parseFloat($('inp-eod').value)||1;
  const doc = new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const PW=297, PH=210, M=14;
  const stamp = new Date();
  let pageNo = 0;

  function frame(title){
    if(pageNo>0) doc.addPage(); pageNo++;
    doc.setFillColor(...PAGE); doc.rect(0,0,PW,PH,'F');
    doc.setFillColor(...NAVY); doc.rect(0,0,PW,20,'F');
    doc.setFillColor(0,229,255); doc.rect(0,20,PW,.7,'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(13);
    doc.text('MOVEMENT CONJECTURE',M,12.5);
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(150,225,238);
    doc.text(title.toUpperCase(),PW-M,12.5,{align:'right'});
    doc.setTextColor(...GREY); doc.setFontSize(7.5);
    doc.text('Radical Deepscale LLC  |  DART Meadow LLC  |  Personal conjecture engine - not a financial model or investment advice',M,PH-6);
    doc.text('Page '+pageNo,PW-M,PH-6,{align:'right'});
  }
  function h2(t,y){ doc.setTextColor(...CYAN); doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.text(t,M,y); doc.setDrawColor(...CYAN); doc.setLineWidth(.25); doc.line(M,y+1.8,PW-M,y+1.8); return y+8; }
  function para(t,y,w,size){ doc.setTextColor(...INK); doc.setFont('helvetica','normal'); doc.setFontSize(size||9); const L=doc.splitTextToSize(t,w||PW-2*M); doc.text(L,M,y); return y+L.length*((size||9)*.45)+2; }
  function picture(im,x,y,w){ if(!im) return y; const u=typeof im==='string'?im:im.url; const ar=typeof im==='string'?(7/12):(im.h/im.w); doc.addImage(u,'JPEG',x,y,w,w*ar); doc.setDrawColor(...CYAN); doc.setLineWidth(.2); doc.rect(x,y,w,w*ar); return y+w*ar; }
  function cap(t,x,y){ doc.setTextColor(...GREY); doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.text(t,x,y); }
  const table=(head,body,y,opt)=>{ doc.autoTable(Object.assign({head:[head],body,startY:y,margin:{left:M,right:M},theme:'grid',
    styles:{font:'helvetica',fontSize:8,cellPadding:1.6,textColor:INK,fillColor:CELL,lineColor:LINE,lineWidth:.15},
    headStyles:{fillColor:HEAD,textColor:[150,235,250],fontStyle:'bold'},alternateRowStyles:{fillColor:CELL2}},opt||{})); return doc.lastAutoTable.finalY+4; };

  /* 1 ── cover & summary */
  frame('Projection report');
  doc.setTextColor(...INK); doc.setFont('helvetica','bold'); doc.setFontSize(26); doc.text('Movement Conjecture',M,48);
  doc.setFont('helvetica','normal'); doc.setFontSize(13); doc.setTextColor(...CYAN); doc.text('Earth Orbital Disc - stock projection with ride, bulge and diverge conditions',M,57);
  let y=70; y=h2('Run parameters',y);
  y=table(['Generated','Tickers','Projection range','EOD sigma','Conditions','Hill strict'],
    [[stamp.toLocaleString(), active.map(s=>s.ticker||'(sigma only)').join(', '), yrS+' - '+yrE, nf(eod,6), MCS.on?'ON':'OFF', MCS.strict?'ON':'OFF']],y);
  y=h2('Summary',y+2);
  y=table(['Stock','Price','Sigma','DLSS','Orbital node (SPNCRYNODE)','History gate','Projected years kept'],
    active.map(s=>{ const c=MCS.cond[s.ticker], r=s.result._ref;
      return [s.ticker||'-', s.price?('$'+s.price.toFixed(2)):'-', nf(s.result.radc,4), nf(s.result.dlss,4), nf(s.result.spncrynode,6),
        c&&c.ok?Math.round(c.gate*100)+'%':'n/a', r?(r.qualified+' of '+r.total):'-']; }),y);
  para('Inputs: tickers 1-3 are familiar areas; tickers 4-5 are adjacent influences. The Sigma-EOD algorithm is unchanged. Added in this report: each projected year is kept only if the accumulated path bulges positive and its divergence exceeds its monthly share; kept years are scaled by the stock\'s historical gate computed from day, week, month and year behaviour.',y+2,PW-2*M,8.5);

  /* 2 ── results + calculation trace */
  frame('Results and calculations');
  y=h2('Stock comparison',30);
  y=table(['Ticker','Price','Sigma inv','Mean unit (a)','DLSS','MFMSP','SMSP^2','CMSP^3','SPNCRYNODE'],
    active.map(s=>{const r=s.result; return [s.ticker||'-','$'+nf(r.rads,2),nf(r.radc,4),nf(r.a,6),nf(r.dlss,4),nf(r.mfmsp,4),nf(r.smsp,4),nf(r.cmsp,4),nf(r.spncrynode,6)];}),y);
  y=h2('Calculation trace',y+2);
  const rowsT=[
    ['c = radc^2','StockPhonic',r=>r.c],['s = rads','StockPhonic',r=>r.s],['a = sqrt(c / s)','Mean unit',r=>r.a],
    ['dx = EOD / a','EODPropG',r=>r.dx],['ar = dx^dx','EODPropG',r=>r.ar],['arr = sqrt(dx / ar)','EODPropG',r=>r.arr],
    ['gtx = a^2','EODPropG',r=>r.gtx],['rtx = a * gtx','EODPropG',r=>r.rtx],['DLSS = rtx^arr','EODPropG',r=>r.dlss],
    ['MFMSP = a * DLSS','GeoPropG',r=>r.mfmsp],['SMSP = MFMSP^2','GeoPropG',r=>r.smsp],['CMSP = MFMSP^3','GeoPropG',r=>r.cmsp],
    ['RMSP = cbrt(MFMSP)','GeoPropG',r=>r.rmsp],['SPNCRYNODE = RMSP^(DLSS*3)','GeoPropG',r=>r.spncrynode]];
  table(['Step','Stage'].concat(active.map(s=>s.ticker||'stock')), rowsT.map(([n,st,f])=>[n,st].concat(active.map(s=>nf(f(s.result),6)))), y,
    {styles:{fontSize:7.5,cellPadding:1.1,textColor:INK,fillColor:CELL,lineColor:LINE,lineWidth:.15},columnStyles:{0:{fontStyle:'bold',cellWidth:55}}});

  /* 3 ── trajectory */
  frame('Long-range trajectory');
  y=h2('Orbital propagation '+yrS+' - '+yrE,30);
  const t2=img2d('chart-trajectory'), t3=MC3D.snapshot('trajectory',[active,yrS,yrE],1200,700);
  const cw=(PW-2*M-6)/2;
  let ya=picture(t2,M,y,cw), yb=picture(t3,M+cw+6,y,cw);
  cap('2D: refined projection (all stocks, shared scale)',M,ya+4); cap('3D: lane per stock; grey = original, colour = refined; green = kept year, red = held',M+cw+6,yb+4);
  y=Math.max(ya,yb)+8;
  const picks=[0,.25,.5,.75,1];
  const tr=[]; picks.forEach(p=>{ const row=[]; active.forEach(s=>{ const b=s.result._base, r=s.result._ref; if(!b){return;} const i=Math.round(p*(b.length-1)); row.push(b[i].year, nf(b[i].val,4), r?nf(r.pts[i].val,4):'-', r?(i===0?'-':(r.flags[i].ok?'kept':'held')):'-'); }); tr.push([row[0]].concat(active.flatMap((s,k)=>row.slice(1+k*4,4+k*4)))); });
  table(['Year'].concat(active.flatMap(s=>[(s.ticker||'stock')+' original',(s.ticker||'stock')+' refined',(s.ticker||'stock')+' step'])),tr,y,{styles:{fontSize:7,cellPadding:1.1,textColor:INK,fillColor:CELL,lineColor:LINE,lineWidth:.15}});

  /* 4 ── geometry */
  frame('MSP geometry');
  y=h2('SMSP / CMSP / RMSP per stock',30);
  const g2=img2d('chart-geo'), g3=MC3D.snapshot('geo',[active],1200,700);
  ya=picture(g2,M,y,cw); yb=picture(g3,M+cw+6,y,cw);
  cap('2D bars',M,ya+4); cap('3D bars (x = metric, depth = stock)',M+cw+6,yb+4);
  y=Math.max(ya,yb)+8;
  table(['Stock','MFMSP','SMSP^2','CMSP^3','RMSP (cube root)','Orbital node'],active.map(s=>[s.ticker||'-',nf(s.result.mfmsp,5),nf(s.result.smsp,5),nf(s.result.cmsp,5),nf(s.result.rmsp,5),nf(s.result.spncrynode,6)]),y);

  /* 5 ── phase */
  frame('EOD phase propagation');
  y=h2('phase = DLSS * cos(t * ARR * pi * 2) * RMSP^(t * 2)',30);
  const p2=img2d('chart-phase'), p3=MC3D.snapshot('phase',[active,yrS,yrE],1200,700);
  ya=picture(p2,M,y,cw); yb=picture(p3,M+cw+6,y,cw);
  cap('2D phase curves'+(_phaseModified?' (with user tangent adjustments)':''),M,ya+4); cap('3D phase lanes; plane = phase 0',M+cw+6,yb+4);
  y=Math.max(ya,yb)+8;
  const curves=_phaseModified?_buildModifiedCurves(_phaseStocks,_phaseDefaultCurves):_phaseDefaultCurves;
  const prow=picks.map(p=>{ const j=Math.round(p*(curves[0].length-1)); return [Math.round(yrS+p*(yrE-yrS)),nf(p,2)].concat(curves.map(c=>nf(c[j].v,4))); });
  table(['Year','t'].concat(active.map(s=>(s.ticker||'stock')+' ARR '+nf(s.result.arr,4))),prow,y);

  /* 6 ── conditions */
  frame('Ride, bulge and diverge conditions');
  y=h2('Rules applied',30);
  y=para('Day: ride high, even or low (all allowed).  Week: bulge positive and diverge greater than every day in that week.  Month: bulge positive in the days and the weeks, diverge greater than every week.  Year: bulge positive in the months, diverge greater than every month.  Multi-year: the accumulation of yearly divergences must bulge positive. Divergence is the net slope of a period; bulge is the area of its cumulative path above the starting level (hill strict additionally rejects a bowl-shaped path).',y,PW-2*M,8.5);
  y=h2('History results (daily data)',y+2);
  const cr=active.map(s=>{ const c=MCS.cond[s.ticker]; const pc=v=>Math.round(v*100)+'%';
    if(!c||!c.ok) return [s.ticker||'-','no history','-','-','-','-','-','-','-'];
    return [s.ticker,c.nDays+' ('+c.from+' to '+c.to+')','up '+c.rideCount.high+' / even '+c.rideCount.even+' / down '+c.rideCount.low,
      pc(c.rates.weekBulge)+' / '+pc(c.rates.weekDiverge), pc(c.rates.monthBulge)+' / '+pc(c.rates.monthDiverge), pc(c.rates.yearBulge)+' / '+pc(c.rates.yearDiverge),
      (c.current.week.bulgeOK?'W ':'')+(c.current.month.bulgeOK?'M ':'')+(c.current.year.bulgeOK?'Y ':'')+(c.current.accumulated.bulgeOK?'Sum':'') || 'none', pc(c.gate), s.result._ref?(s.result._ref.qualified+' of '+s.result._ref.total):'-']; });
  table(['Stock','Days analysed','Daily rides','Week bulge / diverge','Month bulge / diverge','Year bulge / diverge','Qualified now','Gate','Years kept'],cr,y);
  const withC=active.filter(s=>MCS.cond[s.ticker]&&MCS.cond[s.ticker].ok);
  for(let i=0;i<withC.length;i+=2){
    frame('Condition terrain');
    y=h2('3D terrain: day / week / month / year cumulative paths',30);
    withC.slice(i,i+2).forEach((s,k)=>{ const im=MC3D.snapshot('lanes',[MCS.cond[s.ticker],s.color],1200,640);
      const yy=picture(im,M+k*(cw+6),y,cw); doc.setTextColor(...hexRGB(s.color)); doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text(s.ticker,M+k*(cw+6),yy+6);
      cap('green = qualified bulge (days: gold = even, red = low)',M+k*(cw+6)+16,yy+6); });
  }

  /* last ── methodology */
  frame('Methodology');
  y=h2('How to read this report',30);
  y=para('Movement Conjecture maps stock and industry inputs onto the MSP Sigma-EOD algorithm. StockPhonic derives the mean unit a from sigma and price; EODPropG propagates it with the EOD factor to DLSS; GeoPropG derives MFMSP, SMSP (squared), CMSP (cubed), RMSP (cube root) and the orbital node SPNCRYNODE. The trajectory raises the node by a power series of RMSP over the chosen years.',y,PW-2*M,9.5);
  y=para('The ride/bulge/diverge conditions are applied on top of that projection. History (daily closes) classifies each day, week, month and year. A projected year is kept only if the trailing accumulation of years bulges positive and its divergence is positive and above each of its twelve monthly shares; kept years add their original increment multiplied by the history gate (the average of the six bulge and diverge pass rates). Held years add nothing, which is why the refined line flattens where the hill condition fails.',y+1,PW-2*M,9.5);
  y=para('3D graphs: one lane per stock; orbit, pan and dolly in the app. Values in 3D lanes are normalised per lane; the 2D charts keep the shared scale.',y+1,PW-2*M,9.5);
  para('Disclaimer: this is a personal conjecture engine. It is not a financial model, a forecast or advice. Past price behaviour does not predict future results.',y+3,PW-2*M,9.5);
  return doc;
}

async function run(mode){
  try{
    setStatus('Building PDF report (2D + 3D charts)...');
    const doc = await build();
    const name='movement-conjecture-'+new Date().toISOString().slice(0,10)+'.pdf';
    if(mode==='print'){
      const url = doc.output('bloburl');
      const w = window.open(url,'_blank'); if(!w){ location.href=url; }
    } else doc.save(name);
    setStatus('PDF ready: '+name);
  }catch(e){ console.error(e); setStatus('PDF failed: '+e.message); }
}
window.MCPDF = {build, save:()=>run('save'), print:()=>run('print')};
})();
