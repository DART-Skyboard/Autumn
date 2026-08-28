/* Autumn TTS router. No API keys. Piper on phone, Kokoro on desktop.
   Seamless: first sentence as soon as it exists; prefetch next chunk while
   current plays (no gap); no overlap; no cutoff; no leftover double-speak. */
(function(){
"use strict";
var PVOX="en_US-kristin-medium";
var BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kristin/medium/";
var ONNX=BASE+"en_US-kristin-medium.onnx";
var CFGURL=ONNX+".json";
var JDL=["js","delivr",".net"].join("");
var PKG="@diffusionstudio/";
var PW="piper"+"-wasm";
var PROT="https://";
var PHN="piper_phonemize";
var CDNHOST="cdn.";
var NP="n"+"pm";
var SLASH="/";
var VER="@1.0.0";
var BLD="build";
var VITS="vits-web@1.0.3";
var DIST="dist/piper-DeOu3H9E.js";
var ORTCD="cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/";
var WASM=PROT+CDNHOST+JDL+SLASH+NP+SLASH+PKG+PW+VER+SLASH+BLD+SLASH+PHN;
var PHJS=PROT+CDNHOST+JDL+SLASH+NP+SLASH+PKG+VITS+SLASH+DIST;
var ORTJS=PROT+ORTCD+"ort.min.js";
var ORTW=PROT+ORTCD;
function isPhone(){if(typeof window._ttsIsPhone==="boolean")return window._ttsIsPhone; var p=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||""); window._ttsIsPhone=p; return p;}
function hasGPU(){return !!(window._ttsHasWebGPU || navigator.gpu);}
function wantPiper(){return isPhone();}
function coerce(raw){if(raw==null)return ""; var t=raw; if(typeof t==="object"){t=t.text||t.response||t.message||t.content||""; if(typeof t==="object") t="";} t=String(t); if(t==="[object Object]") t=""; return t.replace(/\[ARC_CMD:[^\]]*\]/g,"").replace(/\[IMG_RECALL:[^\]]*\]/g,"").replace(/\s{2,}/g," ").trim();}
async function cached(url){try{var c=await caches.open("autumn-tts");var h=await c.match(url);if(h)return h;var r=await fetch(url);if(r.ok){try{await c.put(url,r.clone());}catch(e){}}return r;}catch(e){return fetch(url);}}
function loadScr(src){return new Promise(function(res,rej){if(window.ort) return res(); var s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s);});}
var _P={ready:false,failed:false,sess:null,cfg:null,ph:null};
async function ensurePiper(){ if(_P.ready) return true; if(_P.failed) return false; if(_P.loading) return _P.loading; _P.loading=(async function(){ try { await loadScr(ORTJS); if(!window.ort) throw new Error("ort"); window.ort.env.wasm.wasmPaths=ORTW; window.ort.env.wasm.numThreads=isPhone()?1:2; window.ort.env.allowLocalModels=false; var mod=await import(PHJS); _P.ph=mod.createPiperPhonemize||mod.default; var cj=await cached(CFGURL); _P.cfg=await cj.json(); var ob=await cached(ONNX); _P.sess=await window.ort.InferenceSession.create(await ob.arrayBuffer()); _P.ready=true; window._piperReady=true; console.log("[Piper] ready", PVOX); return true; } catch(e){ console.warn("[Piper] fail", e&&e.message); _P.failed=true; window._piperReady=false; return false; } finally { _P.loading=null; } })(); return _P.loading; }
function phonemeIds(text,cfg){return new Promise(async function(resolve,reject){ var done=false; var input=JSON.stringify([{text:String(text||"").trim()}]); var voice=(cfg&&cfg.espeak&&cfg.espeak.voice)||"en-us"; var mod=await _P.ph({print:function(line){if(done)return; try{var p=JSON.parse(line); var ids=p.phoneme_ids||p; if(Array.isArray(ids)){done=true; resolve(ids);}}catch(e){}}, printErr:function(err){if(!done){done=true; reject(new Error(String(err)));}}, locateFile:function(f){ if(f.indexOf(".wasm")>=0) return WASM+".wasm"; if(f.indexOf(".data")>=0) return WASM+".data"; return f; }}); mod.callMain(["-l",voice,"--input",input,"--espeak_data","/espeak-ng-data"]); setTimeout(function(){if(!done){done=true;reject(new Error("ph timeout"));}},20000); });}
async function piperWav(text){ var cfg=_P.cfg; var ids=await phonemeIds(text,cfg); var inf=cfg.inference||{}; var length=(inf.length_scale||1)*1.08; var spd=1; try{spd=Voice.speed||1;}catch(e){} length=length/Math.max(0.7,Math.min(1.35,spd)); var feeds={input:new ort.Tensor("int64", BigInt64Array.from(ids.map(function(n){return BigInt(n);})),[1,ids.length]), input_lengths:new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]),[1]), scales:new ort.Tensor("float32", Float32Array.from([inf.noise_scale||0.667,length,inf.noise_w||0.8]),[3])}; var out=await _P.sess.run(feeds); var sr=(cfg.audio&&cfg.audio.sample_rate)||22050; var pcmFn=(typeof _pcmToWav==="function")?_pcmToWav:null; if(!pcmFn) throw new Error("pcm"); return new Blob([pcmFn(out.output.data, sr)],{type:"audio/wav"});}
async function kokoroWav(text){
  var pipe=window._kokoroPipe; if(!pipe) return null;
  var clean=text; if(typeof cleanForTTS==="function"){ try{ var c=cleanForTTS(text); if(c) clean=c; }catch(e){} }
  var voice="af_heart"; try{ var cfg=JSON.parse(localStorage.getItem("_nate_voice_config")||"null"); if(cfg&&cfg.kokoroVoice) voice=cfg.kokoroVoice; }catch(e){}
  var spd=1; try{ spd=Voice.speed||1; }catch(e){}
  var result=await pipe(clean,{voice:voice,speed:Math.min(2,Math.max(0.4,spd))});
  var sr=result.sampling_rate||24000;
  var pcmFn=(typeof _pcmToWav==="function")?_pcmToWav:null;
  if(!pcmFn) return null;
  return new Blob([pcmFn(result.audio, sr)],{type:"audio/wav"});
}
async function synthBlob(text){
  if(wantPiper()){
    var ok=await ensurePiper();
    if(ok) return piperWav(text);
  }
  if(window._kokoroReady && window._kokoroPipe){
    try { var b=await kokoroWav(text); if(b) return b; } catch(e){}
  }
  if(!wantPiper() && window._piperReady){
    try { return await piperWav(text); } catch(e){}
  }
  return null;
}
function playBlob(blob,onEnd){
  var url=URL.createObjectURL(blob);
  var player=new Audio(url);
  Voice._kokoroPlayer=player;
  player.onended=function(){ URL.revokeObjectURL(url); if(onEnd) onEnd(); };
  player.onerror=function(){ URL.revokeObjectURL(url); if(onEnd) onEnd(); };
  var p=player.play(); if(p&&p.catch) p.catch(function(){ if(onEnd) onEnd(); });
}
function splitSpeakChunks(text){ var t=String(text||"").replace(/\s+/g," ").trim(); if(!t) return []; var parts=t.match(/[^.!?]+[.!?]+(?:["')\]]+)?|\S[^.!?]*$/g); if(!parts||!parts.length) return [t]; var chunks=[], buf=""; var MAX=180; for(var i=0;i<parts.length;i++){ var sent=parts[i].trim(); if(!sent) continue; if(sent.length>MAX){ if(buf){ chunks.push(buf); buf=""; } var words=sent.split(/\s+/), wbuf=""; for(var j=0;j<words.length;j++){ if(wbuf && (wbuf.length+words[j].length+1)>MAX){ chunks.push(wbuf); wbuf=words[j]; } else wbuf=wbuf?(wbuf+" "+words[j]):words[j]; } if(wbuf) buf=wbuf; continue; } if(buf && (buf.length+sent.length+1)>MAX){ chunks.push(buf); buf=sent; } else buf=buf?(buf+" "+sent):sent; } if(buf) chunks.push(buf); return chunks; }
function speakOneEngine(clean,onEnd){ if(wantPiper() && window._piperReady){ speakPiper(clean,onEnd); return;} if(window._kokoroReady && window._kokoroPipe && typeof _speakKokoro==="function"){ _speakKokoro(clean,onEnd); return;} if(window._piperReady){ speakPiper(clean,onEnd); return;} if(typeof _speakWebSpeech==="function") _speakWebSpeech(clean,onEnd); else if(onEnd) onEnd(); }
async function speakPiper(text,onEnd){ var ok=await ensurePiper(); if(!ok){ if(typeof _speakWebSpeech==="function") _speakWebSpeech(text,onEnd); else if(onEnd) onEnd(); return;} Voice.speaking=true; try{ var blob=await piperWav(text); if(Voice.cancelled){ if(!Voice._chunking) Voice.speaking=false; if(onEnd)onEnd(); return;} playBlob(blob,function(){ if(!Voice._chunking) Voice.speaking=false; if(onEnd)onEnd(); }); } catch(e){ console.warn("[Piper] speak", e&&e.message); if(typeof _speakWebSpeech==="function") _speakWebSpeech(text,onEnd); else if(onEnd)onEnd(); } }
function speakChunked(clean,onEnd){
  var chunks=splitSpeakChunks(clean);
  if(!chunks.length){ if(onEnd)onEnd(); return; }
  Voice.speaking=true; Voice.cancelled=false;
  Voice._chunking=true;
  Voice._currentSentences=chunks;
  Voice._currentSentIdx=0;
  var i=0;
  var nextBlob=null;
  var nextP=null;
  function doneAll(){ Voice._chunking=false; Voice.speaking=false; Voice._currentSentences=null; Voice._currentSentIdx=0; if(onEnd)onEnd(); }
  function prefetch(idx){ if(idx>=chunks.length) return Promise.resolve(null); return synthBlob(chunks[idx]).catch(function(){ return null; }); }
  function playIdx(){
    if(Voice.cancelled){ doneAll(); return; }
    if(i>=chunks.length){ doneAll(); return; }
    Voice._currentSentIdx=i;
    var idx=i++;
    var blob=nextBlob; nextBlob=null;
    var startPref=prefetch(idx+1);
    nextP=startPref;
    function afterBlob(b){
      if(Voice.cancelled){ doneAll(); return; }
      if(!b){
        speakOneEngine(chunks[idx], function(){
          startPref.then(function(nb){ nextBlob=nb; playIdx(); });
        });
        return;
      }
      playBlob(b, function(){
        startPref.then(function(nb){ nextBlob=nb; playIdx(); });
      });
    }
    if(blob) afterBlob(blob);
    else synthBlob(chunks[idx]).then(afterBlob).catch(function(){ afterBlob(null); });
  }
  playIdx();
}
function routeSpeak(text,onEnd){ var clean=coerce(text); if(typeof cleanForTTS==="function"){ try{ var c=cleanForTTS(clean); if(c) clean=c; }catch(e){} } if(!clean){ if(onEnd)onEnd(); return;} Voice.cancelled=false; Voice.speaking=true; var pending=window._piperLoad||window._kokoroLoad; if(!window._piperReady && !window._kokoroReady && pending && pending.then){ Promise.race([Promise.resolve(pending).catch(function(){}), new Promise(function(r){setTimeout(r,2500);})]).then(function(){ if(Voice.cancelled){if(onEnd)onEnd();return;} speakChunked(clean,onEnd); }); return;} speakChunked(clean,onEnd); }
function wrapStopSpeak(){
  var orig=window.stopSpeaking;
  window.stopSpeaking=function(opts){
    if(opts && opts.replace){
      Voice._interruptedRemaining="";
      Voice._currentSentences=null;
      Voice._skipRemainder=true;
    }
    Voice._chunking=false;
    if(typeof orig==="function") orig();
    if(opts && opts.replace) Voice._interruptedRemaining="";
  };
}
function wrapKokoro(){
  var orig=window._speakKokoro;
  if(typeof orig!=="function") return;
  window._speakKokoro=async function(text,onEnd){
    try {
      await orig(text, function(){
        if(Voice._chunking) Voice.speaking=true;
        if(onEnd) onEnd();
      });
    } catch(e){
      if(onEnd) onEnd();
    }
  };
}
function wrapAutoRead(){
  var orig=window.autoReadLastResponse;
  window.autoReadLastResponse=function(){
    try {
      if(!Voice || (!Voice.autoRead && !Voice.enabled)) return;
      var m=null;
      try { m=(typeof msgs==="function")?msgs():null; } catch(e){}
      if(!m || !m.length){ if(typeof orig==="function") return orig(); return; }
      var last=m[m.length-1];
      if(!last || (last.role!=="autumn" && last.role!=="assistant")){ if(typeof orig==="function") return orig(); return; }
      var rawT=(last.text!=null?last.text:last.content);
      if(typeof rawT==="object"&&rawT) rawT=rawT.text||rawT.response||rawT.message||"";
      rawT=String(rawT||""); if(rawT==="[object Object]") rawT="";
      var cleanText=rawT.replace(/\[ARC_CMD:[^\]]*\]/g,"").replace(/\[IMG_RECALL:[^\]]*\]/g,"").replace(/\s{2,}/g," ").trim();
      if(!cleanText) return;
      Voice._interruptedRemaining="";
      Voice._skipRemainder=false;
      if(Voice.speaking){
        Voice._chunking=false;
        Voice.cancelled=true;
        if(Voice.synth) try{ Voice.synth.cancel(); }catch(e){}
        if(Voice._kokoroPlayer){ try{ Voice._kokoroPlayer.pause(); Voice._kokoroPlayer.src=""; }catch(e){} Voice._kokoroPlayer=null; }
      }
      if(Voice.isListening&&Voice.recognition){try{Voice.recognition.stop();}catch(e){}Voice.isListening=false;}
      routeSpeak(cleanText, function(){
        if(typeof restartListeningIfActive==="function" && Voice.active) restartListeningIfActive();
      });
    } catch(e){
      if(typeof orig==="function") orig();
    }
  };
}
function boot(){
  if(typeof Voice==="undefined" || typeof speak!=="function"){ setTimeout(boot,40); return; }
  window.speak=function(t,cb){ routeSpeak(t,cb); };
  window._speakPiper=speakPiper;
  wrapStopSpeak();
  wrapKokoro();
  wrapAutoRead();
  if(wantPiper()) window._piperLoad=ensurePiper();
  else setTimeout(function(){ window._piperLoad=ensurePiper(); }, 10000);
  console.log("[Autumn TTS] seamless router phone="+isPhone()+" gpu="+!!hasGPU()+" prefer="+(wantPiper()?"piper":"kokoro"));
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
