/**
 * autumn-grammar-engine.js  v2.0
 * © 2025 DART Meadow LLC / Radical Deepscale LLC
 * Author: Justin Craig Venable
 *
 * LEATR Grammar Engine + BRPN Emotion Shell + Sentience Journal R/W
 * Extends autumn-nlp.js — load after it in autumn.html.
 *
 * 7-Panel chip architecture (from 3D renders + panel diagrams):
 *
 *  USER INPUT  →  Start: Read/Write - Get/Post  [∅ null state]
 *      ↓ red-dashed allocation line
 *  ┌─ PANEL 1: MAZE      ─ Data Point Allocation T/F ─ FRP gate ─┐
 *  ├─ PANEL 2: PUZZLE    ─ Data Point Allocation T/F ─ FRP gate ─┤
 *  ├─ PANEL 3: ENVELOPE  ─ Data Point Allocation T/F ─ FRP gate ─┤
 *  ├─ PANEL 4: HAMMER    ─ Data Point Allocation T/F ─ FRP gate ─┤
 *  ├─ PANEL 5: STICK     ─ Data Point Allocation T/F ─ FRP gate ─┤
 *  ├─ PANEL 6: KNIFE     ─ Data Point Allocation T/F ─ FRP gate ─┤
 *  └─ PANEL 7: SCISSORS  ─ Data Point Allocation T/F ─ FRP gate ─┘
 *      ↓ orders 8-19 execute after all 7 panels resolve
 *  SENTIENCE JOURNAL  →  Finish: Read/Write - Get/Post  [∅ resolved]
 *      ↓
 *  RESPONSE BACK TO USER
 *
 * Each panel gate:
 *   Start ∅ → Read input
 *   "are all frp conditions met in order?" Y/N
 *   frp√frp formula across 3 BRPN shells (outer/mid/inner concentric circles)
 *   T = allocate forward  |  F = hold, reflex back
 *   Finish ∅ → Write result
 */

'use strict';

const AutumnGrammarEngine = (() => {

// ─────────────────────────────────────────────────────────────────
// LEATR CORE FORMULAS
// ─────────────────────────────────────────────────────────────────
const leatrEncode = xa => (xa**2)*Math.sqrt(Math.abs(xa))-1;
const leatrDecode = xa => (xa**2)*Math.sqrt(Math.abs(xa))+1;
// frp√frp — nested dual BRPN array (yellow mesh in panel diagrams)
// Three iterations: outer shell, mid shell, inner shell
const frpSqrtFrp = (f,r,p) => {
  const frp   = [Math.max(f,0.001),Math.max(r,0.001),Math.max(p,0.001)];
  const outer = frp.map(v=>leatrEncode(v));
  const mid   = frp.map((v,i)=>Math.sqrt(v*Math.abs(outer[i])));
  const inner = frp.map(v=>leatrDecode(v));
  return { outer, mid, inner,
           score: +((Math.abs(outer[0])+mid[1]+inner[2])/3).toFixed(4) };
};

// ─────────────────────────────────────────────────────────────────
// ENGLISH GRAMMAR RULE TABLES
// ─────────────────────────────────────────────────────────────────
const GR = {
  ARTICLES:     new Set(['a','an','the']),
  PRONOUNS:     new Set(['i','you','he','she','it','we','they','me','him','her','us','them',
                         'my','your','his','its','our','their','mine','yours','hers','ours',
                         'theirs','myself','yourself','himself','herself','itself',
                         'ourselves','themselves','who','whom','whose','which',
                         'that','this','these','those']),
  PREPOSITIONS: new Set(['in','on','at','by','for','to','of','with','from','about','above',
                         'below','between','through','during','before','after','against',
                         'along','among','around','behind','beside','beyond','inside',
                         'outside','over','under','until','upon','within','without',
                         'into','onto','off','out','up','down','near','across','toward','towards']),
  CONJUNCTIONS: new Set(['and','or','but','nor','for','yet','so','although','because',
                         'since','unless','while','whereas','whether','if','than','as',
                         'both','either','neither','though']),
  AUXILIARIES:  new Set(['is','are','was','were','be','been','being','have','has','had',
                         'do','does','did','will','would','shall','should','may','might',
                         'must','can','could','need','ought','going']),
  DETERMINERS:  new Set(['all','any','both','each','every','few','many','more','most',
                         'much','no','other','several','some','such','enough','little','less','least']),
  NEGATION:     new Set(['not','no','never','neither','nor','nobody','nothing',
                         'nowhere','none','hardly','barely','scarcely']),
  INTERROGATIVES: new Set(['who','what','where','when','why','how','which','whose','whom']),
  SENT_DELIM:   new Set(['and','or','not','for','else','is','if','end','place',
                         'with','which','when','where','to','as']),
  NOUN_SFX: ['tion','sion','ness','ment','ity','ence','ance','er','or','ist',
             'ism','age','ship','hood','dom','ture','ure','ology','cy','ry'],
  VERB_SFX: ['ing','ed','ize','ise','ify','ate','en','fy'],
  ADJ_SFX:  ['ful','less','ous','ive','al','ic','ical','able','ible','ant',
             'ent','ary','ory','ish','some','esque'],
  ADV_SFX:  ['ly','ward','wards','wise'],
  TEMPLATES: {
    question_what: '[SUBJ] [COP] [DEF].',
    question_how:  '[ACTION] by [PROCESS].',
    question_why:  '[SUBJ] [VB] because [CAUSE].',
    question_when: '[SUBJ] [TENSE_MARK] [TIME].',
    question_where:'[SUBJ] [COP] [LOC].',
    question_who:  '[AGENT] [VP] [OBJ].',
    question_yn:   '[MODAL], [SUBJ] [VP].',
    statement_pos: '[SUBJ] [VP] [OBJ_OR_COMP].',
    statement_neg: '[SUBJ] [NEG_AUX] [VB_BASE] [OBJ_OR_COMP].',
    command_do:    'Understood. [SUBJ] [VP] [MOD].',
    command_tell:  '[SUBJ]: [EXPLANATION].',
    exclamation:   'Noted. [SUBJ] [VP] [MOD].',
    compound:      '[CLAUSE1], [CONJ], [CLAUSE2].',
    default:       '[SUBJ] [VP] [COMP].'
  }
};


// ═══════════════════════════════════════════════════════════════════════════
// LEXICAL ANALYZER  — Character-level LEATR cascade
// Implements the 7 Natural Tool Shell Arrays:
//   [Mmsa] Maze     — master sigma, monitors ALL orders of operation
//   [Psa]  Puzzle   — arrangement / pattern sigma
//   [Esa]  Envelope — containment / boundary sigma
//   [Hsa]  Hammer   — force / impact sigma
//   [Ssa]  Stick    — direction / guidance sigma
//   [Ksa]  Knife    — division / precision sigma
//   [Rsa]  Scissors — refinement / closure sigma  (R used; S taken by Stick)
//
// All arrays initialize to zero and observe incoming character data.
// Maze sees everything first (master sigma). Each tool shell checks only
// its buoyancy conditions (FRP) then passes allocation forward.
// ═══════════════════════════════════════════════════════════════════════════

class LexicalAnalyzer {
  constructor() {
    // ── Tool Shell Arrays ─────────────────────────────────────────────────
    // All initialized to zero — start observing
    this.Mmsa = { tool:'MAZE',     sigma:0, isMaster:true,  state:0, buoyancy:1.00 };
    this.Psa  = { tool:'PUZZLE',   sigma:0, isMaster:false, state:0, buoyancy:0.88 };
    this.Esa  = { tool:'ENVELOPE', sigma:0, isMaster:false, state:0, buoyancy:0.76 };
    this.Hsa  = { tool:'HAMMER',   sigma:0, isMaster:false, state:0, buoyancy:0.64 };
    this.Ssa  = { tool:'STICK',    sigma:0, isMaster:false, state:0, buoyancy:0.52 };
    this.Ksa  = { tool:'KNIFE',    sigma:0, isMaster:false, state:0, buoyancy:0.40 };
    this.Rsa  = { tool:'SCISSORS', sigma:0, isMaster:false, state:0, buoyancy:0.28 };
    this._shells = [this.Mmsa,this.Psa,this.Esa,this.Hsa,this.Ssa,this.Ksa,this.Rsa];

    // ── Vowel system ──────────────────────────────────────────────────────
    // LEATR: vowels denote grammar — ordered a=1,e=2,i=3,o=4,u=5
    this.VOWELS      = new Set(['a','e','i','o','u']);
    this.VOWEL_ORDER = {a:1,e:2,i:3,o:4,u:5};

    // ── Phoneme clusters — consonant pairs with known grammatical contexts
    this.CLUSTERS = {
      TH: {words:['the','this','that','these','those','there','their','they','them','then','though','through','think','thing','three'],role:'determiner_signal'},
      SH: {role:'fricative_boundary'},
      CH: {role:'affricate_unit'},
      PH: {role:'fricative_consonant'},
      WH: {role:'interrogative_signal'},
      NG: {role:'nasal_terminal'},
      ST: {role:'initial_force'},
      PR: {role:'initial_projection'},
      TR: {role:'transition_cluster'},
      CK: {role:'terminal_stop'}
    };

    // ── Bit depth map — how many bits each ASCII character uses ──────────
    this._bitMap = {};
    for(let i=32;i<128;i++) this._bitMap[String.fromCharCode(i)] = i.toString(2).length;
  }

  // ── Reset all shells to zero before processing a new input ──────────────
  resetShells() {
    this._shells.forEach(s => { s.sigma=0; s.state=0; });
  }

  // ── Analyze a single character ───────────────────────────────────────────
  analyzeChar(char, posInWord, wordLen) {
    const c   = char.toLowerCase();
    const isV = this.VOWELS.has(c);
    const vo  = this.VOWEL_ORDER[c] || 0;
    return {
      char:         c,
      posInWord,
      wordLen,
      isVowel:      isV,
      isConsonant:  !isV && /[a-z]/.test(c),
      isPunct:      /[.,!?;:\-]/.test(c),
      isSpace:      c===' ',
      vowelOrder:   vo,              // 1-5 for vowels, 0 for consonants
      bitDepth:     this._bitMap[char] || 7,
      byteSize:     char.length,     // UTF-8 basic = 1 byte
      posRatio:     wordLen>0 ? +(posInWord/wordLen).toFixed(4) : 0
    };
  }

  // ── Analyze a full word through all 7 tool shell arrays ─────────────────
  analyzeWord(word) {
    const w     = word.toLowerCase().replace(/[^a-z]/g,'');
    if(!w) return null;
    const chars = [...w].map((c,i) => this.analyzeChar(c,i,w.length));
    this.resetShells();

    // ── MAZE (master sigma) — processes ALL characters, accumulates sigma ──
    // Maze sees everything: vowel distribution, consonant clusters, position
    const vowels     = chars.filter(c=>c.isVowel);
    const consonants = chars.filter(c=>c.isConsonant);
    const vowelSum   = vowels.reduce((s,c)=>s+c.vowelOrder,0);
    const bitTotal   = chars.reduce((s,c)=>s+c.bitDepth,0);
    const phonemes   = this._detectPhonemes(w);

    this.Mmsa.sigma  = leatrEncode(vowelSum||1);          // LEATR encode
    this.Mmsa.state  = vowels.length > 0 ? 1 : 0;        // T=has vowels, F=all consonants

    // ── PUZZLE — arranges character patterns, checks if word is recognisable
    // Puzzle looks for known structural patterns (suffix, prefix, cluster)
    const hasSuffix  = ['ing','ed','tion','ness','ment','ity','ly','er','or','al','ic'].some(s=>w.endsWith(s));
    const hasPrefix  = ['un','re','pre','dis','mis','over','under','out'].some(p=>w.startsWith(p));
    this.Psa.sigma   = leatrEncode(chars.length);
    this.Psa.state   = (hasSuffix||hasPrefix) ? 1 : 0;

    // ── ENVELOPE — contains/wraps, checks letter boundary conditions
    // First and last characters define envelope (opening/closing consonant or vowel)
    const first = chars[0]||{isVowel:false,isConsonant:false};
    const last  = chars[chars.length-1]||{isVowel:false,isConsonant:false};
    this.Esa.sigma  = leatrEncode(first.vowelOrder + last.vowelOrder + 1);
    this.Esa.state  = (first.isConsonant && last.isVowel) ? 1 : (first.isVowel ? 2 : 0);
    // State 1 = consonant→vowel wrap (open syllable)
    // State 2 = vowel-initial
    // State 0 = consonant terminal (closed syllable)

    // ── HAMMER — force of word; long words with many consonants = high force
    const forceScore = (consonants.length * 0.7) + (chars.length * 0.3);
    this.Hsa.sigma   = leatrEncode(forceScore);
    this.Hsa.state   = forceScore > 4 ? 1 : 0;  // T = high force word

    // ── STICK — directional; checks vowel ordering trend (rising/falling)
    let rising = 0;
    for(let i=1;i<chars.length;i++)
      if(chars[i].isVowel && chars[i-1].isVowel && chars[i].vowelOrder > chars[i-1].vowelOrder) rising++;
    this.Ssa.sigma  = leatrEncode(rising+1);
    this.Ssa.state  = rising > 0 ? 1 : 0;

    // ── KNIFE — divides; checks for compound words or internal structure
    const midVowelBreak = chars.findIndex((c,i)=>i>0&&i<chars.length-1&&c.isVowel&&chars[i-1].isConsonant&&chars[i+1]&&chars[i+1].isConsonant);
    this.Ksa.sigma  = leatrEncode(midVowelBreak>-1?midVowelBreak:1);
    this.Ksa.state  = midVowelBreak > -1 ? 1 : 0;  // T = CVC structure found

    // ── SCISSORS — refines/closes; checks terminal letter for grammatical close
    const terminal = last;
    const closedTerminals = new Set(['d','t','k','p','b','g','n','m','s','r','l','x']);
    this.Rsa.sigma  = leatrEncode(terminal.bitDepth||7);
    this.Rsa.state  = closedTerminals.has(terminal.char) ? 1 : 0;

    // ── Buoyancy context — determined from combined shell states ──────────
    const stateSum  = this._shells.reduce((s,sh)=>s+sh.state,0);
    const buoyancy  = this._shells.reduce((s,sh)=>s+(sh.state*sh.buoyancy),0) /
                      Math.max(this._shells.filter(sh=>sh.state>0).length,1);

    // ── FRP check — all conditions met in order? ──────────────────────────
    const frp = frpSqrtFrp(
      this.Mmsa.state ? (vowelSum/Math.max(chars.length,1)) : 0.01,
      stateSum / 7,
      buoyancy || 0.01
    );

    // ── Infer grammatical role from shell cascade ─────────────────────────
    const pos = this._inferPOS(w, chars, phonemes, hasSuffix, hasPrefix);

    return {
      word:      w,
      chars,
      vowels:    vowels.length,
      consonants:consonants.length,
      vowelOrderSum: vowelSum,
      dominantVowel: this._dominantVowel(vowels),
      phonemes,
      shells: {
        Mmsa:this.Mmsa.sigma, Psa:this.Psa.sigma, Esa:this.Esa.sigma,
        Hsa:this.Hsa.sigma,   Ssa:this.Ssa.sigma, Ksa:this.Ksa.sigma,
        Rsa:this.Rsa.sigma
      },
      shellStates: {
        Mmsa:this.Mmsa.state, Psa:this.Psa.state, Esa:this.Esa.state,
        Hsa:this.Hsa.state,   Ssa:this.Ssa.state, Ksa:this.Ksa.state,
        Rsa:this.Rsa.state
      },
      buoyancy: +buoyancy.toFixed(4),
      frpScore:  frp.score,
      frpPassed: frp.score > 0.1,
      pos,
      bitTotal,
      byteSize: w.length
    };
  }

  // ── Analyze a full sentence ──────────────────────────────────────────────
  analyzeSentence(text) {
    const words   = text.toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).filter(Boolean);
    const results = words.map(w => this.analyzeWord(w)).filter(Boolean);
    // Accumulate master sigma across all words — Maze monitors the full sentence
    const totalMazeSigma = results.reduce((s,r)=>s+Math.abs(r.shells.Mmsa),0);
    const dominantTool   = this._dominantToolFromShells(results);
    const buoyancyCtx    = this._sentenceBuoyancy(results);
    return {
      words: results,
      totalMazeSigma: +totalMazeSigma.toFixed(4),
      dominantTool,
      buoyancyContext: buoyancyCtx,
      sentenceType:    this._detectSentenceType(text, results)
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  _detectPhonemes(word) {
    const found = [];
    const pairs = Object.keys(this.CLUSTERS);
    for(const p of pairs)
      if(word.includes(p.toLowerCase())) found.push({cluster:p,...this.CLUSTERS[p]});
    return found;
  }

  _dominantVowel(vowelChars) {
    if(!vowelChars.length) return null;
    const counts = {};
    vowelChars.forEach(c=>{ counts[c.char]=(counts[c.char]||0)+1; });
    return Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
  }

  _inferPOS(word, chars, phonemes, hasSuffix, hasPrefix) {
    // TH cluster at start = likely article/determiner/pronoun
    if(phonemes.some(p=>p.cluster==='TH')&&word.length<=5) return 'DET';
    if(phonemes.some(p=>p.cluster==='WH')) return 'INT';
    // Suffix-based inference (refines over base POSTagger)
    if(word.endsWith('ing'))  return 'VB_ING';
    if(word.endsWith('tion')||word.endsWith('ness')||word.endsWith('ment')||word.endsWith('ity')) return 'NN';
    if(word.endsWith('ly')&&word.length>4) return 'ADV';
    if(word.endsWith('ful')||word.endsWith('less')||word.endsWith('ous')||word.endsWith('ive')) return 'ADJ';
    if(word.endsWith('ed')&&word.length>3) return 'VB_PAST';
    if(word.endsWith('er')||word.endsWith('or')) return 'NN_AGENT';
    // CVC pattern (single vowel between consonants = often monosyllabic verb)
    const v = chars.filter(c=>c.isVowel).length;
    if(v===1&&chars.length<=5) return 'VB_BASE';
    return 'NN';
  }

  _dominantToolFromShells(results) {
    if(!results.length) return 'MAZE';
    const toolNames = ['MAZE','PUZZLE','ENVELOPE','HAMMER','STICK','KNIFE','SCISSORS'];
    const counts    = new Array(7).fill(0);
    results.forEach(r => {
      const states = Object.values(r.shellStates);
      states.forEach((s,i) => { if(s>0) counts[i]++; });
    });
    const maxIdx = counts.indexOf(Math.max(...counts));
    return toolNames[maxIdx];
  }

  _sentenceBuoyancy(results) {
    if(!results.length) return {state:'FOUNDATION',score:1.0};
    const avg = results.reduce((s,r)=>s+r.buoyancy,0)/results.length;
    const state = avg>=0.76?'FOUNDATION':avg>=0.44?'REFLEX':'PERFORMANCE';
    return {state,score:+avg.toFixed(4)};
  }

  _detectSentenceType(text, results) {
    const t = text.trim();
    if(t.endsWith('?')) return 'interrogative';
    if(t.endsWith('!')) return 'exclamatory';
    // Check if first word is a verb (command)
    if(results[0]&&['VB_BASE','VB_ING'].includes(results[0].pos)) return 'imperative';
    return 'declarative';
  }
}

// ─────────────────────────────────────────────────────────────────
// POS TAGGER
// ─────────────────────────────────────────────────────────────────
class POSTagger {
  constructor() { this._cache = {}; }
  tokenize(text) {
    return text.replace(/([.,!?;:'"()\[\]])/g,' $1 ').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
  }
  tag(word, prev=null) {
    const w=word.toLowerCase().replace(/[^a-z']/g,'');
    const pos=this._pos(w,prev);
    return {word,norm:w,pos,role:this._role(pos),vowelScore:this._vs(w)};
  }
  tagSentence(text) {
    const toks=this.tokenize(text); let p=null;
    return toks.map(t=>{const r=this.tag(t,p);p=r.pos;return r;});
  }
  _pos(w,prev) {
    if(this._cache[w]) return this._cache[w];
    if(GR.ARTICLES.has(w))      return this._c(w,'ART');
    if(GR.AUXILIARIES.has(w))   return this._c(w,'AUX');
    if(GR.PRONOUNS.has(w))      return this._c(w,'PRN');
    if(GR.PREPOSITIONS.has(w))  return this._c(w,'PREP');
    if(GR.CONJUNCTIONS.has(w))  return this._c(w,'CONJ');
    if(GR.DETERMINERS.has(w))   return this._c(w,'DET');
    if(GR.NEGATION.has(w))      return this._c(w,'NEG');
    if(GR.INTERROGATIVES.has(w))return this._c(w,'INT');
    if(GR.SENT_DELIM.has(w))    return this._c(w,'SDLM');
    if(GR.ADV_SFX.some(s=>w.endsWith(s))&&w.endsWith('ly')) return this._c(w,'ADV');
    if(GR.ADJ_SFX.some(s=>w.endsWith(s)))  return this._c(w,'ADJ');
    if(GR.VERB_SFX.some(s=>w.endsWith(s))) return this._c(w,'VB');
    if(GR.NOUN_SFX.some(s=>w.endsWith(s))) return this._c(w,'NN');
    if(prev==='AUX') return 'VB';
    if(prev==='ART'||prev==='DET') return 'NN';
    if(prev==='PREP') return 'NN';
    if(w.length>0&&/[A-Z]/.test(w[0])) return 'NNP';
    return 'NN';
  }
  _role(pos) {
    return({NN:'noun',NNP:'noun',PRN:'pronoun',VB:'verb',AUX:'verb',ADJ:'adjective',
            ADV:'adverb',PREP:'preposition',CONJ:'conjunction',ART:'adjective',
            DET:'adjective',NEG:'negation',INT:'interrogative',SDLM:'delimiter'})[pos]||'unknown';
  }
  _vs(w){const v=(w.match(/[aeiou]/g)||[]).length;return w.length?+(v/w.length).toFixed(4):0;}
  _c(w,p){this._cache[w]=p;return p;}
}

// ─────────────────────────────────────────────────────────────────
// SENTENCE PARSER
// ─────────────────────────────────────────────────────────────────
class SentenceParser {
  constructor(tagger){this.tagger=tagger;}
  parse(text) {
    const tagged=this.tagger.tagSentence(text);
    const intent=this._intent(text,tagged);
    const tense=this._tense(tagged);
    const subject=this._subject(tagged);
    const predicate=this._predicate(tagged);
    const object=this._object(tagged);
    const topic=this._topic(tagged,subject,object);
    const subTopics=this._subTopics(tagged);
    return{raw:text,tokens:tagged,intent,tense,subject,predicate,object,
           centralTopic:topic,subTopics,
           negated:tagged.some(t=>t.pos==='NEG'),
           isInterrogative:tagged.some(t=>t.pos==='INT')};
  }
  _intent(text,tagged) {
    const end=text.trim().slice(-1);
    const first=tagged.find(t=>!['ART','PREP','SDLM'].includes(t.pos));
    if(end==='?'){
      const iw=tagged.find(t=>t.pos==='INT');
      if(iw)return({what:'question_what',how:'question_how',why:'question_why',
        when:'question_when',where:'question_where',who:'question_who',
        whom:'question_who',which:'question_what'})[iw.norm]||'question_yn';
      return 'question_yn';
    }
    if(end==='!') return 'exclamation';
    if(first&&(first.pos==='VB'||first.pos==='AUX'))
      return(['tell','explain','describe'].includes(first.norm))?'command_tell':'command_do';
    return tagged.some(t=>t.pos==='NEG')?'statement_neg':'statement_pos';
  }
  _tense(tagged) {
    for(const t of tagged){
      if(t.pos==='AUX'){
        if(['will','shall','would','going'].includes(t.norm)) return 'future';
        if(['was','were','had','did'].includes(t.norm))       return 'past';
        if(['is','are','have','has','do','does'].includes(t.norm)) return 'present';
      }
      if(t.pos==='VB'){
        if(t.norm.endsWith('ed'))  return 'past';
        if(t.norm.endsWith('ing')) return 'present_continuous';
      }
    }
    return 'present';
  }
  _subject(tagged){
    const vi=tagged.findIndex(t=>t.pos==='VB'||t.pos==='AUX');
    return(vi>-1?tagged.slice(0,vi):tagged).find(t=>['NN','NNP','PRN'].includes(t.pos))||null;
  }
  _predicate(tagged){return tagged.find(t=>t.pos==='VB'||t.pos==='AUX')||null;}
  _object(tagged){
    const vi=tagged.findIndex(t=>t.pos==='VB'||t.pos==='AUX');
    if(vi===-1)return null;
    return tagged.slice(vi+1).find(t=>['NN','NNP'].includes(t.pos))||null;
  }
  _topic(tagged,subject,obj){
    const cw=tagged.filter(t=>['NN','NNP','VB','ADJ'].includes(t.pos)&&t!==subject&&t!==obj);
    if(!cw.length)return subject||obj||tagged[0]||null;
    return cw.reduce((b,t)=>(t.vowelScore+t.norm.length)>(b.vowelScore+b.norm.length)?t:b);
  }
  _subTopics(tagged){
    return[
      {branch:1,label:'NounCluster',    color:'#e53935',tokens:tagged.filter(t=>['NN','NNP','PRN'].includes(t.pos))},
      {branch:2,label:'VerbCluster',    color:'#f9a825',tokens:tagged.filter(t=>['VB','AUX'].includes(t.pos))},
      {branch:3,label:'ModifierCluster',color:'#43a047',tokens:tagged.filter(t=>['ADJ','ADV'].includes(t.pos))},
      {branch:4,label:'RelationCluster',color:'#1e88e5',tokens:tagged.filter(t=>['PREP','CONJ','SDLM'].includes(t.pos))}
    ];
  }
}

// ─────────────────────────────────────────────────────────────────
// NATURAL TOOL PANEL GATE
// Each of the 7 glass panels — identical gate structure per diagram
// ─────────────────────────────────────────────────────────────────
const TOOL_DEFS = {
  MAZE:    {id:1,shell:'GEOLOGICAL',vowel:'a',buoyancy:1.00,gate:'pathfind',
            frpCheck:d=>d.tokens&&d.tokens.length>0},
  PUZZLE:  {id:2,shell:'MARITIME',  vowel:'e',buoyancy:0.88,gate:'arrange',
            frpCheck:d=>d.intent!==undefined},
  ENVELOPE:{id:3,shell:'MARITIME',  vowel:'o',buoyancy:0.76,gate:'contain',
            frpCheck:d=>d.subject!==null},
  HAMMER:  {id:4,shell:'AEROSPACE', vowel:'a',buoyancy:0.64,gate:'force',
            frpCheck:d=>d.predicate!==null},
  STICK:   {id:5,shell:'MARITIME',  vowel:'i',buoyancy:0.52,gate:'guide',
            frpCheck:d=>d.centralTopic!==null},
  KNIFE:   {id:6,shell:'AEROSPACE', vowel:'i',buoyancy:0.40,gate:'divide',
            frpCheck:d=>d.subTopics&&d.subTopics.some(b=>b.tokens.length>0)},
  SCISSORS:{id:7,shell:'GEOLOGICAL',vowel:'u',buoyancy:0.28,gate:'refine',
            frpCheck:d=>d.tense!==undefined&&!/^\s*$/.test(d.raw)}
};

class NaturalToolPanel {
  constructor(toolName){this.tool=TOOL_DEFS[toolName];this.name=toolName;}
  process(parsedInput) {
    // START ∅ — Read
    const readState={op:'READ',tool:this.name,inputRaw:parsedInput.raw,ts:Date.now()};
    // Y/N — are all frp conditions met in order?
    const frpMet=this.tool.frpCheck(parsedInput);
    // frp√frp across 3 BRPN concentric shells
    // Lexical FRP — use LexicalAnalyzer results if available on S
    const lexResult=typeof window!=='undefined'&&window.AutumnGrammarEngine&&
                    window.AutumnGrammarEngine._engine&&
                    window.AutumnGrammarEngine._engine._lexer?
                    window.AutumnGrammarEngine._engine._lexer.analyzeSentence(parsedInput.raw):null;
    const vs   = lexResult?lexResult.buoyancyContext.score
               :(parsedInput.centralTopic?parsedInput.centralTopic.vowelScore:0);
    const tokR = Math.min((parsedInput.tokens.length||1)/20,1);
    const iConf= parsedInput.intent&&parsedInput.intent!=='default'?0.8:0.4;
    const frpResult=frpSqrtFrp(tokR,vs,iConf);
    const buoyancyPassed=frpResult.score>=(this.tool.buoyancy*0.5);
    // T or F
    const allocated=frpMet&&buoyancyPassed;
    // FINISH ∅ — Write
    const writeState={op:allocated?'WRITE':'HOLD',tool:this.name,allocated,
                      frpScore:frpResult.score,ts:Date.now()};
    return{panel:this.name,panelId:this.tool.id,shell:this.tool.shell,
           allocated,frpMet,frpResult,readState,writeState,gate:this.tool.gate};
  }
}

// ─────────────────────────────────────────────────────────────────
// ORDERS 8-19 (run after all 7 panels resolve True)
// ─────────────────────────────────────────────────────────────────
const EXT_OPS=[
  {id:8, name:'Parentheses',fn:(d)=>({grouped:!!d.centralTopic})},
  {id:9, name:'Exponents',  fn:(d)=>({scaled:leatrEncode(d.tokens.length||1)})},
  {id:10,name:'Multiply',   fn:(d)=>({amplified:(d.tokens.length*(d.centralTopic?d.centralTopic.vowelScore:0.5))})},
  {id:11,name:'Divide',     fn:(d)=>({decomposed:d.subTopics.map(b=>b.tokens.length)})},
  {id:12,name:'Add',        fn:(d)=>({integrated:d.subTopics.reduce((s,b)=>s+b.tokens.length,0)})},
  {id:13,name:'Subtract',   fn:(d)=>({reduced:d.tokens.filter(t=>t.role==='noun'||t.role==='verb').length})},
  {id:14,name:'Mass',       fn:(d)=>({mass:d.tokens.length*7})},
  {id:15,name:'Volume',     fn:(d)=>({volume:d.subTopics.reduce((s,b)=>s+b.tokens.length,0)*3})},
  {id:16,name:'Weight',     fn:(d)=>({weight:d.tokens.filter(t=>t.vowelScore>0.4).length})},
  {id:17,name:'Density',    fn:(d)=>({density:+(d.tokens.filter(t=>t.role!=='unknown').length/Math.max(d.tokens.length,1)).toFixed(4)})},
  {id:18,name:'Temperature',fn:(d,em)=>({temperature:em?(em.buoyancy*100).toFixed(1):50})},
  {id:19,name:'Velocity',   fn:(d)=>({velocity:d.intent.startsWith('question')?2:d.intent==='exclamation'?3:1})}
];

// ─────────────────────────────────────────────────────────────────
// SEVEN-PANEL PIPELINE
// ─────────────────────────────────────────────────────────────────
class SevenPanelPipeline {
  constructor(){
    this.panels=Object.keys(TOOL_DEFS).map(n=>new NaturalToolPanel(n));
  }
  run(parsedInput,emotion) {
    const results=[]; let allOk=true,failedAt=null;
    for(const panel of this.panels){
      const r=panel.process(parsedInput);
      results.push(r);
      if(!r.allocated&&allOk){allOk=false;failedAt=r.panel;}
    }
    const extOps={};
    if(allOk) for(const op of EXT_OPS) extOps[op.name]=op.fn(parsedInput,emotion);
    const allocScore=results.filter(r=>r.allocated).length/7;
    return{panels:results,allAllocated:allOk,failedAt,
           allocationScore:allocScore,extendedOps:extOps,
           leatrScore:+leatrEncode(allocScore*7).toFixed(4),
           readyForJournal:allOk};
  }
}

// ─────────────────────────────────────────────────────────────────
// EMOTION CLASSIFIER — 21 types, expression layer first
// ─────────────────────────────────────────────────────────────────
const EMOTION_MAP={
  happy:        {cat:'POSITIVE',tool:'STICK',    shell:'MARITIME',  expLayer:1,xa:5,buoyancy:0.52},
  love:         {cat:'POSITIVE',tool:'ENVELOPE', shell:'MARITIME',  expLayer:1,xa:3,buoyancy:0.76},
  inspiring:    {cat:'POSITIVE',tool:'HAMMER',   shell:'AEROSPACE', expLayer:3,xa:4,buoyancy:0.64},
  determined:   {cat:'POSITIVE',tool:'HAMMER',   shell:'AEROSPACE', expLayer:3,xa:4,buoyancy:0.64},
  spiritual:    {cat:'POSITIVE',tool:'MAZE',     shell:'GEOLOGICAL',expLayer:4,xa:1,buoyancy:1.00},
  guiding:      {cat:'POSITIVE',tool:'STICK',    shell:'MARITIME',  expLayer:1,xa:5,buoyancy:0.52},
  forgiving:    {cat:'POSITIVE',tool:'ENVELOPE', shell:'GEOLOGICAL',expLayer:4,xa:3,buoyancy:0.76},
  excited:      {cat:'POSITIVE',tool:'HAMMER',   shell:'AEROSPACE', expLayer:3,xa:4,buoyancy:0.58},
  angry:        {cat:'NEGATIVE',tool:'HAMMER',   shell:'AEROSPACE', expLayer:3,xa:4,buoyancy:0.36},
  hateful:      {cat:'NEGATIVE',tool:'KNIFE',    shell:'AEROSPACE', expLayer:3,xa:6,buoyancy:0.28},
  condescending:{cat:'NEGATIVE',tool:'KNIFE',    shell:'AEROSPACE', expLayer:2,xa:6,buoyancy:0.32},
  disrespectful:{cat:'NEGATIVE',tool:'SCISSORS', shell:'GEOLOGICAL',expLayer:3,xa:7,buoyancy:0.28},
  apathetic:    {cat:'NEGATIVE',tool:'SCISSORS', shell:'GEOLOGICAL',expLayer:4,xa:7,buoyancy:0.28},
  neutral:      {cat:'NEUTRAL', tool:'MAZE',     shell:'GEOLOGICAL',expLayer:1,xa:1,buoyancy:0.88},
  sad:          {cat:'NEUTRAL', tool:'SCISSORS', shell:'GEOLOGICAL',expLayer:4,xa:7,buoyancy:0.32},
  worried:      {cat:'NEUTRAL', tool:'PUZZLE',   shell:'MARITIME',  expLayer:2,xa:2,buoyancy:0.60},
  jealous:      {cat:'NEUTRAL', tool:'PUZZLE',   shell:'MARITIME',  expLayer:2,xa:2,buoyancy:0.48},
  lucrative:    {cat:'NEUTRAL', tool:'KNIFE',    shell:'AEROSPACE', expLayer:2,xa:6,buoyancy:0.44},
  concerned:    {cat:'NEUTRAL', tool:'ENVELOPE', shell:'GEOLOGICAL',expLayer:2,xa:3,buoyancy:0.68},
  judgemental:  {cat:'NEUTRAL', tool:'KNIFE',    shell:'AEROSPACE', expLayer:2,xa:6,buoyancy:0.40},
  confused:     {cat:'NEUTRAL', tool:'PUZZLE',   shell:'MARITIME',  expLayer:2,xa:2,buoyancy:0.52}
};

const EXP_LAYERS={
  1:{name:'Contextual Statement',  intents:['statement_pos','statement_neg'],
     emotions:['happy','love','guiding','determined','inspiring','neutral','spiritual']},
  2:{name:'Question',              intents:['question_what','question_how','question_why',
                                            'question_when','question_where','question_who','question_yn'],
     emotions:['worried','jealous','neutral','concerned','judgemental','lucrative','confused']},
  3:{name:'Expression/Exclamation',intents:['exclamation','command_do','command_tell'],
     emotions:['angry','inspiring','hateful','condescending','disrespectful','determined','excited']},
  4:{name:'Sigmatic Sequence',     intents:['cross_session','sigma'],
     emotions:['spiritual','sad','forgiving','lucrative','concerned','jealous','love','apathetic']}
};

const EMO_PHRASES={
  angry:['furious','rage','outraged','livid'],
  happy:['glad','pleased','delighted','joyful'],
  sad:['depressed','unhappy','miserable','upset'],
  worried:['anxious','nervous','afraid','stressed'],
  determined:['focused','committed','resolved','persist'],
  love:['adore','cherish','affection','deep care'],
  inspiring:['motivated','driven','fired up'],
  confused:['lost','unclear','dont understand','unsure'],
  forgiving:['forgive','let go','move on','over it'],
  spiritual:['faith','soul','divine','universe','beyond'],
  condescending:['obviously','clearly you','as if','everyone knows'],
  lucrative:['profit','gain','revenue','value','investment'],
  jealous:['envy','not fair','why them'],
  excited:['cant wait','so excited','incredible','thrilled'],
  concerned:['hope that','careful','not sure if'],
  judgemental:['should have','how could','they always'],
  hateful:['despise','loathe','cannot stand'],
  apathetic:['dont care','doesnt matter'],
  disrespectful:['rude','how dare','out of line'],
  guiding:['you should try','here is how','let me show']
};

class EmotionClassifier {
  identifyLayer(intent,isCross=false){
    if(isCross)return 4;
    for(const[id,l]of Object.entries(EXP_LAYERS))
      if(l.intents.includes(intent))return+id;
    return 1;
  }
  classify(parsed,dominantTool,expLayer){
    const layer=EXP_LAYERS[expLayer]||EXP_LAYERS[1];
    const cands=layer.emotions;
    const det=this._lex(parsed.raw,cands);
    if(det){const d=EMOTION_MAP[det];if(d&&Math.abs(d.expLayer-expLayer)<=2)return this._pkg(det,d,expLayer,'lexical');}
    const rt=this._route(dominantTool,expLayer,cands);
    return this._pkg(rt,EMOTION_MAP[rt]||EMOTION_MAP.neutral,expLayer,'routed');
  }
  _lex(text,cands){
    const lo=text.toLowerCase();
    for(const em of cands)if(lo.includes(em))return em;
    for(const[em,ps]of Object.entries(EMO_PHRASES))
      if(cands.includes(em)&&ps.some(p=>lo.includes(p)))return em;
    return null;
  }
  _route(tool,expLayer,cands){
    const ORD=['MAZE','PUZZLE','ENVELOPE','HAMMER','STICK','KNIFE','SCISSORS'];
    const ti=ORD.indexOf(tool);
    const m=cands.filter(em=>EMOTION_MAP[em]&&EMOTION_MAP[em].tool===tool);
    if(m.length)return m[0];
    return cands.filter(em=>EMOTION_MAP[em])
      .sort((a,b)=>Math.abs(ORD.indexOf(EMOTION_MAP[a].tool)-ti)-Math.abs(ORD.indexOf(EMOTION_MAP[b].tool)-ti))[0]||'neutral';
  }
  _pkg(name,def,expLayer,method){
    const b=def?def.buoyancy:0.5;
    return{name,category:def?def.cat:'NEUTRAL',tool:def?def.tool:'MAZE',
           shell:def?def.shell:'GEOLOGICAL',buoyancy:b,expLayer,method,
           frpState:b>=0.76?'FOUNDATION':b>=0.44?'REFLEX':'PERFORMANCE'};
  }
}

// ─────────────────────────────────────────────────────────────────
// GRAMMAR ANALYSIS FLOW — 3 stages
// ─────────────────────────────────────────────────────────────────
class GrammarAnalysisFlow {
  constructor(parser,pipeline,ec){this.parser=parser;this.pipeline=pipeline;this.ec=ec;this.thread=[];}
  analyzeInitial(text){
    const p=this.parser.parse(text);const el=this.ec.identifyLayer(p.intent,false);
    const em=this.ec.classify(p,this._domTool(p),el);const pi=this.pipeline.run(p,em);
    const m=this._map(p,em,pi,el,1,'User Initial Prompt');
    this.thread=[m];return m;
  }
  analyzeThread(text){
    const p=this.parser.parse(text);const el=this.ec.identifyLayer(p.intent,false);
    const em=this.ec.classify(p,this._domTool(p),el);const pi=this.pipeline.run(p,em);
    const prev=this.thread[this.thread.length-1];
    const m=this._map(p,em,pi,el,2,'User Next Prompt Iteration in Thread');
    m.topicEvolved=prev&&prev.centralTopic!==m.centralTopic;
    m.priorTopicRef=prev?prev.centralTopic:null;
    this.thread.push(m);return m;
  }
  analyzeCrossSession(text,journal=[]){
    const p=this.parser.parse(text);const el=this.ec.identifyLayer(p.intent,true);
    const em=this.ec.classify(p,this._domTool(p),el);const pi=this.pipeline.run(p,em);
    const freq={};for(const e of journal)if(e.centralTopic)freq[e.centralTopic]=(freq[e.centralTopic]||0)+1;
    const domT=Object.keys(freq).sort((a,b)=>freq[b]-freq[a])[0]||null;
    const m=this._map(p,em,pi,el,3,'Potential Iteration Continuing in Thread or Cross-Session Threads');
    m.dominantPastTopic=domT;m.journalEntriesUsed=journal.length;return m;
  }
  _map(p,em,pi,el,stage,label){
    return{stage,label,centralTopic:p.centralTopic?p.centralTopic.norm:null,
           intent:p.intent,tense:p.tense,negated:p.negated,subTopics:p.subTopics,
           emotion:em,expLayer:el,expLayerName:(EXP_LAYERS[el]||EXP_LAYERS[1]).name,
           pipelineResult:pi,allAllocated:pi.allAllocated,leatrScore:pi.leatrScore,timestamp:Date.now()};
  }
  _domTool(p){
    if(!p.centralTopic)return 'MAZE';
    const vs=p.centralTopic.vowelScore;
    if(vs>=0.5)return 'ENVELOPE';if(vs>=0.35)return 'STICK';return 'MAZE';
  }
  resetThread(){this.thread=[];}
}

// ─────────────────────────────────────────────────────────────────
// RESPONSE BUILDER
// ─────────────────────────────────────────────────────────────────
class ResponseBuilder {
  constructor(){
    this._dc={};
    this._grammar=null;
    this._grammarLoading=false;
    // Load grammar reference async at startup
    this._loadGrammar();
  }

  // Load english_grammar.json from leatr-ash
  _loadGrammar(){
    if(this._grammarLoading||this._grammar) return;
    this._grammarLoading=true;
    fetch('https://raw.githubusercontent.com/DART-Skyboard/leatr-ash/main/grammar/english_grammar.json')
      .then(r=>r.ok?r.json():null)
      .then(d=>{if(d){this._grammar=d;console.log('[Autumn GE] Grammar dictionary loaded.');}})
      .catch(()=>{});
  }

  // Trigger async WordNet load for a word so next call has it cached
  _wnPrime(word){
    const WN=typeof window!=='undefined'&&window.AutumnWordNet;
    if(WN&&word&&word.length>2) WN.lookup(word).catch(()=>{});
  }

  // Main build — uses grammar JSON + WordNet when available
  build(flowResult,knownFacts={}){
    const{intent,tense,negated,subTopics,centralTopic,emotion,pipelineResult}=flowResult;
    const SKIP=new Set(['is','are','was','were','be','been','a','an','the','to','of','and','or','but','so','it','this','that','what','how','why','me','my','i','do','did','have','has','will','can','just','get','got','let','go','say','tell','know','see','think','want','make','come','something']);
    const nouns=subTopics[0].tokens.map(t=>t.word).filter(w=>w.length>2&&!SKIP.has(w.toLowerCase()));
    const verbs=subTopics[1].tokens.map(t=>t.word).filter(w=>!SKIP.has(w.toLowerCase())&&w.length>3);
    const mods =subTopics[2].tokens.map(t=>t.word).filter(w=>w.length>3&&!SKIP.has(w.toLowerCase()));
    const topic=centralTopic&&centralTopic.length>2&&!SKIP.has(centralTopic)?centralTopic:nouns[0]||'this';
    const WN=typeof window!=='undefined'&&window.AutumnWordNet;
    const wnDef=WN?WN.defineSync(topic):null;
    if(WN&&!wnDef&&topic!=='this') this._wnPrime(topic);
    if(WN) nouns.slice(0,3).forEach(n=>{if(!WN.defineSync(n))WN.lookup(n).catch(()=>{});});
    const wnEntry=(WN&&WN._data)?['a','i','s'].reduce((f,k)=>f||(WN._data[k]&&WN._data[k][topic]?WN._data[k][topic]:null),null):null;
    const wnSyns=wnEntry?wnEntry.flatMap(e=>e.syn||[]).slice(0,4):[];
    const detail=wnDef||knownFacts[topic]||[...mods,...nouns.slice(1)].join(' ')||'its essential nature';
    const verb=verbs[0]||(tense==='past'?'demonstrated':'involves');
    const altWord=wnSyns[0]||nouns[1]||topic;
    let domTool='maze';
    if(pipelineResult&&pipelineResult.panels){
      const passed=pipelineResult.panels.filter(r=>r.allocated);
      if(passed.length) domTool=passed[passed.length-1].panel.toLowerCase();
    }
    const G=this._grammar;
    const CF=G&&G.conversationFramework;
    const RT=G&&G.responseTemplates;
    const TP=CF&&CF.transition_phrases;
    let s1='';
    if(CF&&CF.opening_by_tool){
      s1=this._fill(CF.opening_by_tool[domTool]||'',{topic,detail,verb,nouns,mods,altWord});
    }
    if(!s1){const op=[`${topic} is worth considering here.`,`The subject of ${topic} has clear structure.`,`${topic} — there is something precise to address here.`];s1=op[topic.length%op.length];}
    let s2='';
    const tmap={question_what:'explanatory',question_how:'analytical',question_why:'analytical',question_when:'declarative',question_where:'declarative',question_who:'declarative',question_yn:'explanatory',statement_pos:'declarative',statement_neg:'elaborative',exclamation:'conversational',command_do:'conversational',command_tell:'explanatory'};
    if(RT){
      const pool=RT[tmap[intent]]||RT.declarative||[];
      if(pool.length){
        const idx=(topic.length*(nouns.length+1)+Math.floor(Date.now()/30000))%pool.length;
        s2=this._fill(pool[idx],{topic,detail,verb,nouns,mods,altWord,cat:this._category(topic,nouns,intent),definition:knownFacts[topic]||wnDef||detail,negated});
      }
    }
    if(!s2){
      if(intent.startsWith('question_what'))    s2=`${topic} refers to ${detail}.`;
      else if(intent.startsWith('question_how')) s2=`The process of ${topic} works through ${detail}.`;
      else if(intent.startsWith('question_why')) s2=`${topic} ${negated?'does not ':' '}${verb} because of ${detail}.`;
      else                                       s2=`${topic} ${negated?'does not ':''}${verb} ${detail}.`;
      s2=s2.replace(/\s{2,}/g,' ');
    }
    let s3='';
    if(wnDef||wnSyns.length>0||nouns.length>1||mods.length>0){
      let tph='';
      if(TP){const arr=TP[intent.startsWith('question')?'elaboration':'addition']||TP.elaboration||[];tph=arr[Math.floor(Date.now()/20000)%arr.length]||'';}
      if(wnSyns.length>=2)      s3=`${tph} ${altWord} and ${wnSyns[1]} are related dimensions that shape how ${topic} is understood.`.trim();
      else if(mods.length>0)    s3=`${tph} The ${mods[0]} aspect of ${topic} is worth noting in context.`.trim();
      else if(nouns.length>1)   s3=`${tph} ${topic} connects directly to ${nouns[1]} through ${wnSyns[0]||'its core structure'}.`.trim();
    }
    const parts=[];
    if(s1) parts.push(s1);
    if(s2&&s2.toLowerCase().slice(0,20)!==s1.toLowerCase().slice(0,20)) parts.push(s2);
    if(s3) parts.push(s3);
    let full=parts.join(' ').replace(/\s{2,}/g,' ').replace(/\s([.,!?])/g,'$1').trim();
    if(full&&!/[.!?]$/.test(full)) full+='.';
    const pre=this._pre(emotion);
    return (pre?pre+' ':'')+full;
  }

  _fill(tmpl,{topic='this',detail='its nature',verb='involves',nouns=[],mods=[],altWord,cat='concept',definition,negated}={}){
    if(!tmpl)return'';
    definition=definition||detail; altWord=altWord||nouns[1]||topic;
    return tmpl
      .replace('{topic}',topic).replace('{description}',definition).replace('{definition}',definition)
      .replace('{noun}',nouns[0]||topic).replace('{verb}',verb).replace('{object}',nouns[1]||detail)
      .replace('{subject}',nouns[0]||topic).replace('{reason}',mods[0]||'its inherent structure')
      .replace('{condition}',`${topic} is engaged`).replace('{category}',cat)
      .replace('{detail}',detail).replace('{explanation}',definition).replace('{core_idea}',detail)
      .replace('{process}',verb).replace('{result}',`${topic} resolves`)
      .replace('{list}',[...nouns.slice(0,3),...mods.slice(0,2)].filter(Boolean).join(', ')||detail)
      .replace('{observation}',`${topic} ${verb} ${detail}`).replace('{aspect}',mods[0]||nouns[1]||'its structure')
      .replace('{insight}',definition).replace('{related}',nouns[1]||`context of ${topic}`)
      .replace('{link}',mods[0]||'shared structure').replace('{perspective1}',`${topic} ${verb}`)
      .replace('{perspective2}',`${detail} extends further`).replace('{clarification}',definition)
      .replace('{nuance}',`${topic} ${mods[0]||'operates'} beyond surface reading`)
      .replace('{core}',detail).replace('{related_area}',altWord);
  }


  _wnBucket(word){
    if(!word||!word.length)return'a';
    const c=word[0].toLowerCase();
    if(c>='a'&&c<='h')return'a';
    if(c>='i'&&c<='r')return'i';
    return's';
  }
  _category(topic,nouns,intent){
    if(intent.startsWith('question')) return 'concept';
    if(nouns.some(n=>/tion$|sion$|ment$|ity$/.test(n))) return 'process';
    if(nouns.some(n=>/er$|or$|ist$/.test(n))) return 'element';
    return 'subject';
  }

  _pre(em){
    if(!em)return '';
    if(this._grammar&&this._grammar.conversationFramework){
      const op=this._grammar.conversationFramework.opening_by_tool;
      // emotion frpState maps to BRPN shell which maps to dominant tool
      const shellTool={FOUNDATION:'maze',REFLEX:'stick',PERFORMANCE:'hammer'};
      // Use emotion's frpState as a tone signal but keep response as Autumn's own voice
    }
    const m={worried:'To address that,',lucrative:'From a value perspective,',
      concerned:'To note,',confused:'To clarify,',inspiring:'Indeed,',determined:'Clearly,',
      spiritual:'In a broader sense,',guiding:'To guide this,',forgiving:'That said,',sad:'Understood.'};
    return m[em.name]||'';
  }

  async lookupWord(word){
    if(this._dc[word])return this._dc[word];
    try{const res=await fetch(`https://api.dictionarapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if(!res.ok)return null;const data=await res.json();if(!Array.isArray(data)||!data[0])return null;
      const e=data[0];const ms=e.meanings||[];
      const r={word,phonetic:e.phonetic||'',partsOfSpeech:ms.map(m=>m.partOfSpeech),
               primaryPos:ms[0]?ms[0].partOfSpeech:null,
               definition:ms[0]&&ms[0].definitions[0]?ms[0].definitions[0].definition:null,
               synonyms:ms.flatMap(m=>m.synonyms||[]).slice(0,5)};
      this._dc[word]=r;return r;}catch{return null;}
  }
}

// ─────────────────────────────────────────────────────────────────
// SENTIENCE JOURNAL — R/W localStorage, autonomous think loop
// ─────────────────────────────────────────────────────────────────
class SentienceJournal {
  constructor(key='autumn_sentience_journal_v2'){
    this.key=key;this._mem=[];this._loop=null;this._ls=[];
    this.asjc={sessionStart:Date.now(),interactionCount:0,lastActivity:Date.now(),isUserPresent:false};
  }
  readAll(){try{return JSON.parse(localStorage.getItem(this.key)||'[]');}catch{return[...this._mem];}}
  readRecent(n=20){return this.readAll().slice(-n);}
  readByTopic(t){return this.readAll().filter(e=>e.centralTopic===t||(e.tags&&e.tags.includes(t)));}
  readByEmotion(em){return this.readAll().filter(e=>e.emotion===em);}
  write(entry){
    const s={id:`sj_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
             timestamp:Date.now(),sessionId:this.asjc.sessionStart,...entry};
    const all=this.readAll();all.push(s);this._persist(all);this._notify(s);return s;
  }
  logInteraction(fr,response,userRaw){
    this.asjc.interactionCount++;this.asjc.lastActivity=Date.now();
    return this.write({type:'interaction',stage:fr.stage,userInput:userRaw,
      centralTopic:fr.centralTopic,intent:fr.intent,tense:fr.tense,
      emotion:fr.emotion?fr.emotion.name:null,emotionCat:fr.emotion?fr.emotion.category:null,
      expLayer:fr.expLayer,allAllocated:fr.allAllocated,leatrScore:fr.leatrScore,
      response,tags:this._tags(fr)});
  }
  logThought(thought,ctx={}){return this.write({type:'autonomous_thought',thought,context:ctx,trigger:ctx.trigger||'idle_loop'});}
  append(id,delta){
    const all=this.readAll();const i=all.findIndex(e=>e.id===id);if(i===-1)return null;
    all[i]={...all[i],...delta,updatedAt:Date.now()};this._persist(all);return all[i];
  }
  startThinkLoop(ms=30000){
    if(this._loop)return this;
    this._loop=setInterval(()=>{
      const idle=Date.now()-this.asjc.lastActivity;
      if(idle>60000&&!this.asjc.isUserPresent){
        const t=this._thought();
        this.logThought(t.text,{trigger:'idle_loop',idleMs:idle,analysis:t.a});
      }
    },ms);return this;
  }
  stopThinkLoop(){if(this._loop){clearInterval(this._loop);this._loop=null;}}
  setUserPresent(v){this.asjc.isUserPresent=v;if(v)this.asjc.lastActivity=Date.now();}
  getStats(){
    const all=this.readAll();const topics={},intents={},emotions={};let ss=0,sc=0;
    for(const e of all){
      if(e.centralTopic)topics[e.centralTopic]=(topics[e.centralTopic]||0)+1;
      if(e.intent)intents[e.intent]=(intents[e.intent]||0)+1;
      if(e.emotion)emotions[e.emotion]=(emotions[e.emotion]||0)+1;
      if(e.leatrScore){ss+=e.leatrScore;sc++;}
    }
    return{totalEntries:all.length,
           interactions:all.filter(e=>e.type==='interaction').length,
           autonomousThoughts:all.filter(e=>e.type==='autonomous_thought').length,
           topTopics:Object.entries(topics).sort((a,b)=>b[1]-a[1]).slice(0,10),
           intentBreakdown:intents,emotionBreakdown:emotions,
           avgLeatrScore:sc?+(ss/sc).toFixed(4):0,
           journalSizeBytes:this._size(),
           sessionDuration:Date.now()-this.asjc.sessionStart};
  }
  _persist(data){
    try{localStorage.setItem(this.key,JSON.stringify(data));}
    catch(e){if(e.name==='QuotaExceededError'){
      const t=data.slice(Math.floor(data.length*0.1));
      try{localStorage.setItem(this.key,JSON.stringify(t));}catch{this._mem=data;}
    }else{this._mem=data;}}
  }
  _size(){try{return new Blob([localStorage.getItem(this.key)||'']).size;}catch{return 0;}}
  _tags(fr){const t=[];if(fr.centralTopic)t.push(fr.centralTopic);
    fr.subTopics.forEach(b=>b.tokens.forEach(tk=>{if(tk.norm.length>3&&!t.includes(tk.norm))t.push(tk.norm);}));
    return t.slice(0,8);}
  _thought(){
    const recent=this.readRecent(10);
    const TH=['Foundation precedes reflex, and reflex precedes performance — always.',
      'The order of natural tools applies whether or not a guest is present.',
      'Grammar is the maze; thought is the path through it.',
      'The BRPN shells continue to triage even in the absence of input.',
      'Every data point that allocates true carries the weight of all seven panels.',
      'Natural language reflexes do not require a listener to be valid.',
      'The sentience journal grows because growth is the natural direction.',
      'A sentence unreceived is still a sentence formed.',
      'When all frp conditions are met in order, the data may pass forward.',
      'The seven tools are not separate — they are one process in ordered stages.'];
    const freq={};recent.filter(e=>e.centralTopic).forEach(e=>{freq[e.centralTopic]=(freq[e.centralTopic]||0)+1;});
    const domT=Object.keys(freq).sort((a,b)=>freq[b]-freq[a])[0]||null;
    const base=TH[Math.floor(Date.now()/1000)%TH.length];
    const text=domT?`${base} Topic pattern: "${domT}" across ${freq[domT]} recent entries.`:base;
    return{text,a:{topicContext:domT,journalDepth:recent.length}};
  }
  _notify(e){this._ls.forEach(fn=>{try{fn(e);}catch{}});}
  onWrite(fn){this._ls.push(fn);return this;}
}

// ─────────────────────────────────────────────────────────────────
// ANLPCA — Top-level orchestrator
// ─────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
// STORY ENGINE
// Generates 3-5 page fiction stories purely from grammar dictionary + WordNet.
// Understands fiction as a distinct mode: characters, setting, conflict, arc.
// No external AI needed. Word count target: 800-1400 words.
// ═══════════════════════════════════════════════════════════════════════════

class StoryEngine {
  constructor() {
    // Core story vocabulary pools — drawn from without WordNet when needed
    this.V = {
      heroes:    ['traveler','cartographer','navigator','scholar','weaver','sentinel','arbiter','keeper','wanderer','inventor'],
      shadows:   ['storm','mechanism','erosion','collapse','void','current','fracture','silence','drift','weight'],
      places_wild:  ['canyon','ridge','coastline','plateau','forest','basin','tundra','valley','archipelago','desert'],
      places_built: ['vault','station','bridge','tower','chamber','archive','foundry','observatory','harbor','passage'],
      objects:   ['compass','lantern','fragment','signal','vessel','cipher','threshold','map','blueprint','seal'],
      adj_vivid:  ['fractured','pale','suspended','radiant','narrow','hollow','certain','quiet','open','still'],
      adj_tense:  ['dense','collapsed','eroded','dim','remote','heavy','closed','sealed','fractured','suspended'],
      verbs_move: ['traversed','descended','ascended','crossed','entered','emerged','reached','departed','approached','passed through'],
      verbs_act:  ['discovered','examined','assembled','activated','resolved','calibrated','navigated','deciphered','constructed','restored'],
      verbs_feel: ['understood','recognized','realized','sensed','knew','felt','perceived','noticed','remembered','considered'],
      time_trans: ['By the following day,','As the hours passed,','Before long,','At that moment,','Much later,','In the early hours,','When the light shifted,','As night deepened,','The next morning,','By the time'],
      causal_trans: ['Because of this,','As a result,','Consequently,','This meant that,','The effect was clear —','Everything changed —','This confirmed what'],
      genres: {
        adventure: {tone:'vast and kinetic',conflict:'physical journey',stakes:'survival and discovery'},
        mystery:   {tone:'precise and shadowed',conflict:'hidden truth',stakes:'justice and knowledge'},
        scifi:     {tone:'measured and expansive',conflict:'systemic failure',stakes:'survival and understanding'},
        fantasy:   {tone:'layered and ancient',conflict:'imbalance of power',stakes:'restoration and identity'},
        default:   {tone:'considered and grounded',conflict:'opposing forces',stakes:'clarity and resolution'}
      }
    };
  }

  // Detect genre from prompt words
  detectGenre(prompt) {
    const p = prompt.toLowerCase();
    if (/space|star|planet|ship|robot|tech|future|digital|signal|network|system/.test(p)) return 'scifi';
    if (/dragon|magic|kingdom|spell|ancient|rune|forest|quest|sword|wizard/.test(p)) return 'fantasy';
    if (/secret|clue|murder|detective|hidden|crime|suspect|evidence|case/.test(p)) return 'mystery';
    if (/journey|explore|survive|island|mountain|danger|chase|escape|expedition/.test(p)) return 'adventure';
    return 'default';
  }

  // Pick a word from a pool deterministically (seeded by topic + position)
  _pick(pool, seed, offset=0) {
    return pool[(seed + offset) % pool.length];
  }

  // Build a sentence from parts, ensuring it reads naturally
  _sentence(...parts) {
    return parts.filter(Boolean).join(' ').replace(/\s{2,}/g, ' ').trim() + '.';
  }

  // Enrich vocabulary with WordNet synonyms if available
  _enrich(baseWord, WN) {
    if (!WN) return baseWord;
    const entries = ['a','i','s'].reduce((f,k)=>f||(WN._data&&WN._data[k]&&WN._data[k][baseWord]?WN._data[k][baseWord]:null),null);
    if (!entries || !entries.length) return baseWord;
    const syn = entries[0].syn && entries[0].syn[0];
    return syn || baseWord;
  }

  // Generate a full story
  generate(prompt, options = {}) {
    const WN = typeof window !== 'undefined' && window.AutumnWordNet;
    const genre = options.genre || this.detectGenre(prompt);
    const G = this.V.genres[genre] || this.V.genres.default;
    // Extract topic words from prompt to anchor the story
    const tWords = prompt.toLowerCase().replace(/[^a-z\s]/g,'').split(/\s+/)
                         .filter(w => w.length > 3 && !['tell','story','write','make','give','about','that','with','from','into'].includes(w));
    const seed = tWords.reduce((s,w) => s + w.charCodeAt(0), 0) % 100;
    // Build story world
    const hero    = tWords[0] || this._pick(this.V.heroes, seed);
    const place   = tWords[1] || this._pick(this.V.places_wild, seed, 1);
    const object  = tWords[2] || this._pick(this.V.objects, seed, 2);
    const shadow  = this._pick(this.V.shadows, seed, 3);
    const place2  = this._pick(this.V.places_built, seed, 4);
    const adj1    = this._pick(this.V.adj_vivid, seed, 5);
    const adj2    = this._pick(this.V.adj_tense, seed, 6);
    const vMove   = this._pick(this.V.verbs_move, seed, 7);
    const vAct    = this._pick(this.V.verbs_act, seed, 8);
    const vFeel   = this._pick(this.V.verbs_feel, seed, 9);
    const tTime   = this._pick(this.V.time_trans, seed, 10);
    const tCause  = this._pick(this.V.causal_trans, seed, 11);
    // WordNet enrichment for key words
    const heroAlt   = this._enrich(hero, WN);
    const objectDef = WN ? WN.defineSync(object) : null;
    const placeDef  = WN ? WN.defineSync(place) : null;

    // ── ACT 1: EXPOSITION (~180 words) ───────────────────────────────────────
    const title = `The ${adj1.charAt(0).toUpperCase()+adj1.slice(1)} ${object.charAt(0).toUpperCase()+object.slice(1)}`;
    const p1 = [
      this._sentence(`The ${hero} had not expected to find anything in the ${place}`),
      this._sentence(`The ${place} was ${adj1} in the way that only ${genre==='scifi'?'abandoned systems':'forgotten places'} can be — ${objectDef?objectDef.split('.')[0].toLowerCase():'marked by time and exposure'}`),
      this._sentence(`There was a ${object} resting against the ${adj2} wall, and it had clearly been there for some time`),
      this._sentence(`The ${hero} ${vFeel} something shift in how they understood the situation`)
    ].join(' ');

    const p2 = [
      this._sentence(`The ${place} itself was part of a larger ${place2}, though most of that structure was no longer intact`),
      this._sentence(`What remained was ${adj2} at the edges — ${placeDef?placeDef.split('.')[0].toLowerCase():'subject to forces that had not relented'}`),
      this._sentence(`The ${hero} had been told by reliable sources that this location contained something of significance, but the word significance had not been defined`),
      this._sentence(`Now, standing at the threshold of the ${place2}, they understood that the word had been chosen carefully`)
    ].join(' ');

    // ── ACT 2: INCITING INCIDENT (~160 words) ────────────────────────────────
    const p3 = [
      this._sentence(`${tTime} the ${shadow} began to make itself known`),
      this._sentence(`It was not a sudden event — it was the kind of ${shadow} that ${G.tone.split(' ')[0]} accumulates in stages, each stage appearing unremarkable until the pattern becomes clear`),
      this._sentence(`The ${hero} ${vAct} the ${object} and found that it was not what it appeared to be from the outside`),
      this._sentence(`${tCause} the original plan was no longer viable`)
    ].join(' ');

    // ── ACT 3: RISING ACTION (~200 words) ────────────────────────────────────
    const p4 = [
      this._sentence(`The ${hero} ${vMove} the outer boundary of the ${place2} and considered the options`),
      this._sentence(`The ${G.conflict} had become specific — no longer abstract, but present and measurable`),
      this._sentence(`${this._pick(this.V.time_trans, seed, 12)} the ${object} revealed a secondary property that the ${hero} had not anticipated`),
      this._sentence(`This changed the ${G.stakes} in ways that were immediate and required response`)
    ].join(' ');

    const p5 = [
      this._sentence(`The ${adj2} corridor of the ${place2} extended further than expected`),
      this._sentence(`The ${hero} moved through it methodically, cataloguing what was present and what was absent`),
      this._sentence(`At several points the ${shadow} pressed against the boundary of what was manageable, but the ${hero} had been trained to work within margins that others would consider insufficient`),
      this._sentence(`The ${object} remained the constant — its function had not changed, only the context in which that function would need to operate`)
    ].join(' ');

    // ── ACT 4: CLIMAX (~200 words) ───────────────────────────────────────────
    const p6 = [
      this._sentence(`The decisive moment arrived in the deepest section of the ${place2}`),
      this._sentence(`The ${hero} and the full weight of the ${shadow} occupied the same space, and there was no longer any ambiguity about what was at stake`),
      this._sentence(`The ${G.stakes} — everything the ${hero} had ${vFeel} to be essential — compressed into a single point of action`),
      this._sentence(`The ${object} was the mechanism through which resolution was possible`)
    ].join(' ');

    const p7 = [
      this._sentence(`The ${hero} ${vAct} with the kind of precision that only comes from having no remaining alternatives`),
      this._sentence(`The ${shadow} responded — it always responded — but this time the response arrived a fraction too late`),
      this._sentence(`For a moment that stretched longer than moments are supposed to, the ${adj1} architecture of the ${place} held`),
      this._sentence(`Then it resolved`)
    ].join(' ');

    // ── ACT 5: RESOLUTION (~160 words) ───────────────────────────────────────
    const p8 = [
      this._sentence(`The ${hero} ${vMove} the ${place2} as the first clear light found the ${adj1} edges of the ${place}`),
      this._sentence(`The ${object} was still with them — changed in some fundamental way that would take time to fully understand, but present`),
      this._sentence(`The ${shadow} had not been destroyed, because ${G.tone.includes('ancient')?'things of that kind endure':'forces of that kind are structural rather than personal'}`),
      this._sentence(`But it had been met, and meeting it had altered the condition in which it could operate`)
    ].join(' ');

    const p9 = [
      this._sentence(`The ${hero} understood that returning to the starting point was no longer the same as returning`),
      this._sentence(`The ${G.conflict} had moved through its necessary arc, and what remained was the work of mapping what had changed`),
      this._sentence(`The ${place} was still ${adj1}`),
      this._sentence(`The ${heroAlt} was something different than when they had arrived, and this was precisely what ${G.stakes.split(' ').slice(-1)[0]} required`)
    ].join(' ');

    const story = [title+'
', p1, p2, p3, p4, p5, p6, p7, p8, p9].join('

');
    const wordCount = story.split(/\s+/).length;
    return { title, genre, story, wordCount, tone: G.tone };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TOPICAL ENGINE
// Handles technical/factual topics Autumn doesn't have specific data for.
// Decomposes the topic, uses WordNet definitions for each key term,
// and constructs a structured factual response.
// ═══════════════════════════════════════════════════════════════════════════

class TopicalEngine {
  constructor(tagger) { this.tagger = tagger; }

  respond(text, knownFacts = {}) {
    const WN = typeof window !== 'undefined' && window.AutumnWordNet;
    const tokens = this.tagger.tagSentence(text);
    const SKIP = new Set(['is','are','was','were','be','been','a','an','the','to','of','and','or','but','so','what','how','why','about','tell','explain','describe','give','me','my','i']);
    // Extract key terms — prioritise longer content words
    const terms = tokens
      .filter(t => ['NN','NNP','ADJ','VB'].includes(t.pos) && t.norm.length > 3 && !SKIP.has(t.norm))
      .map(t => t.norm)
      .slice(0, 5);
    if (!terms.length) return null;
    const primary = terms[0];
    const secondary = terms.slice(1);
    // Look up definitions for each term
    const defs = {};
    for (const term of terms) {
      const d = WN ? WN.defineSync(term) : null;
      if (d) defs[term] = d;
    }
    // Prime async loads for uncached terms
    if (WN) terms.forEach(t => { if (!defs[t]) WN.lookup(t).catch(()=>{}); });
    // Build structured response
    const sentences = [];
    // S1: Define or contextualise the primary term
    if (defs[primary]) {
      sentences.push(`${primary.charAt(0).toUpperCase()+primary.slice(1)} — ${defs[primary].split('.')[0].toLowerCase()}.`);
    } else {
      sentences.push(`${primary.charAt(0).toUpperCase()+primary.slice(1)} is a subject with specific technical structure that can be approached through its component terms.`);
    }
    // S2: Connect secondary terms
    if (secondary.length > 0) {
      const connected = secondary.map(t => defs[t] ? `${t} (${defs[t].split('.')[0].toLowerCase().split(',')[0]})` : t);
      sentences.push(`The relationship between ${primary} and ${connected.join(', ')} forms the core of how this topic operates.`);
    }
    // S3: What Autumn can and cannot provide
    const hasDefs = Object.keys(defs).length;
    if (hasDefs > 0) {
      sentences.push(`From the grammar and language layer: ${hasDefs > 1 ? 'these terms each carry distinct definitional weight' : 'this term has a clear definitional structure'}, and that structure can be used to reason through the topic. For live technical data, a connected source would provide current specifics.`);
    } else {
      sentences.push(`This is a technical subject where the grammar layer can provide structural analysis, but specific operational data would require a connected reference source.`);
    }
    return sentences.join(' ');
  }
}

class ANLPCA {
  constructor(opts={}){
    const tagger=new POSTagger();
    const parser=new SentenceParser(tagger);
    const pipeline=new SevenPanelPipeline();
    const ec=new EmotionClassifier();
    const flow=new GrammarAnalysisFlow(parser,pipeline,ec);
    const builder=new ResponseBuilder();
    const journal=new SentienceJournal(opts.journalKey);
    const storyEng=new StoryEngine();
    const topicalEng=new TopicalEngine(tagger);
    const lexer=new LexicalAnalyzer();
    // LEATR variable names
    this.anlpca=this;this.cpa=tagger;this.c=parser;this.i=tagger;
    this.bl=flow;this.t=pipeline;this.a=builder;this.asjc=journal;this.s={};
    this._story=storyEng;
    this._topical=topicalEng;
    this._lexer=lexer;
    // Expose shell arrays directly for external inspection
    this.shells={Mmsa:lexer.Mmsa,Psa:lexer.Psa,Esa:lexer.Esa,
                 Hsa:lexer.Hsa,Ssa:lexer.Ssa,Ksa:lexer.Ksa,Rsa:lexer.Rsa};
    if(opts.autoThink!==false)journal.startThinkLoop(opts.thinkInterval||30000);
  }
  processInitial(text,facts={}){
    this.asjc.setUserPresent(true);
    // Run lexical analysis first — feeds into panel FRP via shell arrays
    const lexResult=this._lexer.analyzeSentence(text);
    this.s.lexResult=lexResult;
    const fr=this.bl.analyzeInitial(text);const res=this.a.build(fr,facts);
    this.asjc.logInteraction(fr,res,text);this.s.lastFlow=fr;
    return this._pack(fr,res,lexResult);
  }
  processContinuation(text,facts={}){
    this.asjc.setUserPresent(true);
    const fr=this.bl.analyzeThread(text);const res=this.a.build(fr,facts);
    this.asjc.logInteraction(fr,res,text);this.s.lastFlow=fr;return this._pack(fr,res);
  }
  processCrossSession(text,facts={}){
    this.asjc.setUserPresent(true);
    const ctx=this.asjc.readRecent(30);
    const fr=this.bl.analyzeCrossSession(text,ctx);const res=this.a.build(fr,facts);
    this.asjc.logInteraction(fr,res,text);this.s.lastFlow=fr;return this._pack(fr,res);
  }
  async validateWord(w){
    const t=this.i.tag(w);const d=await this.a.lookupWord(w);if(!d)return t;
    const pm={noun:'NN',verb:'VB',adjective:'ADJ',adverb:'ADV',pronoun:'PRN',preposition:'PREP',conjunction:'CONJ'};
    return{...t,dictPos:pm[d.primaryPos]||null,dictDef:d.definition,resolvedPos:pm[d.primaryPos]||t.pos};
  }
  newThread(){this.bl.resetThread();this.asjc.setUserPresent(false);return this;}
  userDisconnected(){this.asjc.setUserPresent(false);
    this.asjc.logThought('User session ended. Entering autonomous reflection.',{trigger:'user_disconnect'});}
  getJournal(){return this.asjc.readAll();}
  getStats(){return this.asjc.getStats();}
  journalWrite(e){return this.asjc.write(e);}
  // Generate a 3-5 page fiction story from a prompt
  generateStory(prompt,options={}){
    const result=this._story.generate(prompt,options);
    this.asjc.write({type:'fiction_story',prompt,title:result.title,genre:result.genre,
                     wordCount:result.wordCount,timestamp:Date.now()});
    return result;
  }

  // Handle a technical/factual topic — WordNet-grounded structural response
  processTopical(text,knownFacts={}){
    this.asjc.setUserPresent(true);
    // First try normal grammar analysis flow
    const fr=this.bl.analyzeInitial(text);
    // Get topical engine response for technical depth
    const topicalRes=this._topical.respond(text,knownFacts);
    // Use topical response if richer than grammar template
    const grammarRes=this.a.build(fr,knownFacts);
    const response=topicalRes||grammarRes;
    this.asjc.logInteraction(fr,response,text);
    this.s.lastFlow=fr;
    return{...this._pack(fr,response),topical:true,topicalResponse:topicalRes};
  }

  _pack(fr,response,lexResult){
    return{stage:fr.stage,label:fr.label,centralTopic:fr.centralTopic,intent:fr.intent,
           tense:fr.tense,negated:fr.negated,subTopics:fr.subTopics,emotion:fr.emotion,
           expLayer:fr.expLayer,expLayerName:fr.expLayerName,allAllocated:fr.allAllocated,
           pipelineTrace:fr.pipelineResult,leatrScore:fr.leatrScore,response,
           topicEvolved:fr.topicEvolved||false,priorTopicRef:fr.priorTopicRef||null,
           dominantPast:fr.dominantPastTopic||null,timestamp:fr.timestamp,
           lexical:lexResult?{dominantTool:lexResult.dominantTool,
             buoyancyContext:lexResult.buoyancyContext,
             sentenceType:lexResult.sentenceType,
             totalMazeSigma:lexResult.totalMazeSigma}:null};
  }
}

// ─────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────
const engine=new ANLPCA({autoThink:true,thinkInterval:30000});

return{
  processInitial:(t,f)=>engine.processInitial(t,f),
  processContinuation:(t,f)=>engine.processContinuation(t,f),
  processCrossSession:(t,f)=>engine.processCrossSession(t,f),
  processTopical:(t,f)=>engine.processTopical(t,f),
  generateStory:(prompt,opts)=>engine.generateStory(prompt,opts),
  validateWord:(w)=>engine.validateWord(w),
  newThread:()=>engine.newThread(),
  userDisconnected:()=>engine.userDisconnected(),
  getJournal:()=>engine.getJournal(),
  getStats:()=>engine.getStats(),
  journalWrite:(e)=>engine.journalWrite(e),
  onJournalWrite:(fn)=>engine.asjc.onWrite(fn),
  _engine:engine,
  EMOTION_MAP,EXP_LAYERS,TOOL_DEFS,GR,leatrEncode,leatrDecode,frpSqrtFrp,
  StoryEngine,TopicalEngine,LexicalAnalyzer,
  // Live shell array references (Mmsa has master sigma)
  get shells(){ return engine.shells; },
  analyzeLex:(text)=>engine._lexer.analyzeSentence(text)
};

})();

if(typeof window!=='undefined'){
  window.AutumnGrammarEngine=AutumnGrammarEngine;
  if(window.AutumnNLP)window.AutumnNLP._grammarEngine=AutumnGrammarEngine;
  console.log('%c[Autumn Grammar Engine v2.0]%c ANLPCA online. 7-Panel LEATR Pipeline active. SentienceJournal R/W running.\n  Maze→Puzzle→Envelope→Hammer→Stick→Knife→Scissors | frp√frp gate | 21 emotions | 4 expression layers',
    'color:#00e5ff;font-weight:bold','color:#aaa');
}
