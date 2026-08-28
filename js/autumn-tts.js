/* Autumn TTS router. No API keys. */
(function(){
"use strict";
var PVOX="en_US-kristin-medium";
var BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kristin/medium/";
var ONNX=BASE+"en_US-kristin-medium.onnx";
var CFGURL=ONNX+".json";
var JDL=["js","delivr",".net"].join("");
var PKG="@diffusionstudio/";
var PW="piper"+"-wasm";
var WDIR= "cdn-root";
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
function wantPiper(){return isPhone() || !hasGPU();}
function voiceOn(){try{return Voice && (Voice.autoRead||Voice.enabled);}catch(e){return false;}}
function coerce(raw){if(raw==null)return ""; var t=raw; if(typeof t==="object"){t=t.text||t.response||t.message||t.content||""; if(typeof t==="object") t="";} t=String(t); if(t==="[object Object]") t=""; return t.replace(/\[ARC_CMD:[^\]]*\]/g,"").replace(/\[IMG_RECALL:[^\]]*\]/g,"").replace(/\s{2,}/g," ").trim();}
async function cached(url){try{var c=await caches.open("autumn-tts");var h=await c.match(url);if(h)return h;var r=await fetch(url);if(r.ok){try{await c.put(url,r.clone());}catch(e){}}return r;}catch(e){return fetch(url);}}
function loadScr(src){return new Promise(function(res,rej){if(window.ort) return res(); var s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s);});}
var _P={ready:false,failed:false,sess:null,cfg:null,ph:null};
async function ensurePiper(){ if(_P.ready) return true; if(_P.failed) return false; if(_P.loading) return _P.loading; _P.loading=(async function(){ try { await loadScr(ORTJS); if(!window.ort) throw new Error("ort"); window.ort.env.wasm.wasmPaths=ORTW; window.ort.env.wasm.numThreads=isPhone()?1:2; window.ort.env.allowLocalModels=false; var mod=await import(PHJS); _P.ph=mod.createPiperPhonemize||mod.default; var cj=await cached(CFGURL); _P.cfg=await cj.json(); var ob=await cached(ONNX); _P.sess=await window.ort.InferenceSession.create(await ob.arrayBuffer()); _P.ready=true; window._piperReady=true; console.log("[Piper] ready", PVOX); return true; } catch(e){ console.warn("[Piper] fail", e&&e.message); _P.failed=true; window._piperReady=false; return false; } finally { _P.loading=null; } })(); return _P.loading; }
function phonemeIds(text,cfg){return new Promise(async function(resolve,reject){ var done=false; var input=JSON.stringify([{text:String(text||"").trim()}]); var voice=(cfg&&cfg.espeak&&cfg.espeak.voice)||"en-us"; var mod=await _P.ph({print:function(line){if(done)return; try{var p=JSON.parse(line); var ids=p.phoneme_ids||p; if(Array.isArray(ids)){done=true; resolve(ids);}}catch(e){}}, printErr:function(err){if(!done){done=true; reject(new Error(String(err)));}}, locateFile:function(f){ if(f.indexOf(".wasm")>=0) return WASM+".wasm"; if(f.indexOf(".data")>=0) return WASM+".data"; return f; }}); mod.callMain(["-l",voice,"--input",input,"--espeak_data","/espeak-ng-data"]); setTimeout(function(){if(!done){done=true;reject(new Error("ph timeout"));}},20000); });}
async function piperWav(text){ var cfg=_P.cfg; var ids=await phonemeIds(text,cfg); var inf=cfg.inference||{}; var length=(inf.length_scale||1)*1.08; var spd=1; try{spd=Voice.speed||1;}catch(e){} length=length/Math.max(0.7,Math.min(1.35,spd)); var feeds={input:new ort.Tensor("int64", BigInt64Array.from(ids.map(function(n){return BigInt(n);})),[1,ids.length]), input_lengths:new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]),[1]), scales:new ort.Tensor("float32", Float32Array.from([inf.noise_scale||0.667,length,inf.noise_w||0.8]),[3])}; var out=await _P.sess.run(feeds); var sr=(cfg.audio&&cfg.audio.sample_rate)||22050; return new Blob([_pcmToWav(out.output.data, sr)],{type:"audio/wav"});}
async function speakPiper(text,onEnd){ var ok=await ensurePiper(); if(!ok){ if(typeof _speakWebSpeech==="function") _speakWebSpeech(text,onEnd); else if(onEnd) onEnd(); return;} Voice.speaking=true; Voice.cancelled=false; try{ var blob=await piperWav(text); if(Voice.cancelled){Voice.speaking=false; if(onEnd)onEnd(); return;} var url=URL.createObjectURL(blob); var player=new Audio(url); player.onended=function(){ if(!Voice._chunking) Voice.speaking=false; URL.revokeObjectURL(url); if(onEnd)onEnd();}; player.onerror=function(){Voice.speaking=false; if(onEnd)onEnd();}; Voice._kokoroPlayer=player; player.play(); } catch(e){ console.warn("[Piper] speak", e&&e.message); if(typeof _speakWebSpeech==="function") _speakWebSpeech(text,onEnd); else if(onEnd)onEnd(); } }
function splitSpeakChunks(text){ var t=String(text||"").replace(/\s+/g," ").trim(); if(!t) return []; var parts=t.match(/[^.!?]+[.!?]+(?:["')\]]+)?|\S[^.!?]*$/g); if(!parts||!parts.length) return [t]; var chunks=[], buf=""; var MAX=240; for(var i=0;i<parts.length;i++){ var sent=parts[i].trim(); if(!sent) continue; if(sent.length>MAX){ if(buf){ chunks.push(buf); buf=""; } var words=sent.split(/\s+/), wbuf=""; for(var j=0;j<words.length;j++){ if(wbuf && (wbuf.length+words[j].length+1)>MAX){ chunks.push(wbuf); wbuf=words[j]; } else wbuf=wbuf?(wbuf+" "+words[j]):words[j]; } if(wbuf) buf=wbuf; continue; } if(buf && (buf.length+sent.length+1)>MAX){ chunks.push(buf); buf=sent; } else buf=buf?(buf+" "+sent):sent; } if(buf) chunks.push(buf); return chunks; }
function speakOneEngine(clean,onEnd){ if(wantPiper() && window._piperReady){ speakPiper(clean,onEnd); return;} if(window._kokoroReady && window._kokoroPipe && typeof _speakKokoro==="function"){ _speakKokoro(clean,onEnd); return;} if(window._piperReady){ speakPiper(clean,onEnd); return;} if(typeof _speakWebSpeech==="function") _speakWebSpeech(clean,onEnd); else if(onEnd) onEnd(); }
function speakChunked(clean,onEnd){ var chunks=splitSpeakChunks(clean); if(!chunks.length){ if(onEnd)onEnd(); return; } Voice.speaking=true; Voice._chunking=chunks.length>1; Voice._currentSentences=chunks; Voice._currentSentIdx=0; var i=0; function next(){ if(Voice.cancelled){ Voice._chunking=false; Voice.speaking=false; Voice._currentSentences=null; if(onEnd)onEnd(); return; } if(i>=chunks.length){ Voice._chunking=false; Voice.speaking=false; Voice._currentSentences=null; Voice._currentSentIdx=0; if(onEnd)onEnd(); return; } Voice._currentSentIdx=i; speakOneEngine(chunks[i++], next); } next(); }
function routeSpeak(text,onEnd){ var clean=coerce(text); if(typeof cleanForTTS==="function"){ try{ var c=cleanForTTS(clean); if(c) clean=c; }catch(e){} } if(!clean){ if(onEnd)onEnd(); return;} Voice.cancelled=false; Voice.speaking=true; var pending=window._piperLoad||window._kokoroLoad; if(!window._piperReady && !window._kokoroReady && pending && pending.then){ Promise.race([Promise.resolve(pending).catch(function(){}), new Promise(function(r){setTimeout(r,2500);})]).then(function(){ if(Voice.cancelled){if(onEnd)onEnd();return;} speakChunked(clean,onEnd); }); return;} speakChunked(clean,onEnd); }
function boot(){ if(typeof Voice==="undefined" || typeof speak!=="function"){ setTimeout(boot,40); return;} window.speak=function(t,cb){ routeSpeak(t,cb); }; window._speakPiper=speakPiper; if(wantPiper()) window._piperLoad=ensurePiper(); else setTimeout(function(){ window._piperLoad=ensurePiper(); }, 10000); console.log("[Autumn TTS] router phone="+isPhone()+" gpu="+!!hasGPU()+" prefer="+(wantPiper()?"piper":"kokoro")); }
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
