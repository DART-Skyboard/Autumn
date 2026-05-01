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
 *      ↓ orders 8-25 execute (8-19 math/physics, 20-25 photosynthesis + senses) after all 7 panels resolve
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
    if(!results.length) return {words:[],totalMazeSigma:0,dominantTool:'MAZE',
      buoyancyContext:{state:'FOUNDATION',score:1.0},sentenceType:'declarative',consensus:null};

    // Forward pass complete — run backwards concatenation consensus
    const consensus = this._backwardsConcatenation(results);

    const totalMazeSigma = results.reduce((s,r)=>s+Math.abs(r.shells.Mmsa),0);
    const buoyancyCtx    = this._sentenceBuoyancy(results);
    return {
      words: results,
      totalMazeSigma: +totalMazeSigma.toFixed(4),
      // dominantTool comes from consensus, not just first-pass shell states
      dominantTool:   consensus.finalTool,
      buoyancyContext: buoyancyCtx,
      sentenceType:   this._detectSentenceType(text, results),
      consensus       // full backwards concatenation result
    };
  }

  // ── Backwards Concatenation ───────────────────────────────────────────────
  // After all shells process independently, they look at each other's sigmas
  // collectively. Maze arbitrates the final routing as master.
  // The data may route to a different tool than the initial forward-pass result.
  _backwardsConcatenation(wordResults) {
    const TOOLS = ['MAZE','PUZZLE','ENVELOPE','HAMMER','STICK','KNIFE','SCISSORS'];
    const SHELL_KEYS = ['Mmsa','Psa','Esa','Hsa','Ssa','Ksa','Rsa'];
    const BUOYANCIES = [1.00,0.88,0.76,0.64,0.52,0.40,0.28];

    // Step 1 — Collect accumulated sigma per shell across all words
    const accumulated = SHELL_KEYS.map(k =>
      wordResults.reduce((s,r) => s + Math.abs(r.shells[k]||0), 0)
    );

    // Step 2 — Normalise: each shell's share of total sigma
    const total = accumulated.reduce((s,v)=>s+v,0)||1;
    const normalised = accumulated.map(v => +(v/total).toFixed(6));

    // Step 3 — Cross-shell visibility: each shell sees the normalized vector
    // This is the "group look" — shells reading each other's contributions
    // Maze weight is doubled (master sigma)
    const weighted = normalised.map((n,i) => i===0 ? n*2 : n);
    const wTotal   = weighted.reduce((s,v)=>s+v,0)||1;
    const consensus = weighted.map((v,i) => ({
      tool:      TOOLS[i],
      shellKey:  SHELL_KEYS[i],
      sigma:     accumulated[i],
      normalised:normalised[i],
      weight:    +(v/wTotal).toFixed(6),
      buoyancy:  BUOYANCIES[i]
    }));

    // Step 4 — Maze arbitration:
    // The maze looks at the full weighted consensus vector and finds where
    // the sigma convergence actually points. This may redirect from the
    // highest individual-shell result to the true collective centre.
    const mazeSigma  = accumulated[0];     // Maze's own accumulated sigma
    const otherSigmas = accumulated.slice(1);
    const sigmaAvg   = otherSigmas.reduce((s,v)=>s+v,0) / Math.max(otherSigmas.length,1);

    // Maze compares its own sigma to the average of all others
    // If maze sigma > average → maze-level context (geological, foundational)
    // If maze sigma < average → the data drifted toward a specific inner tool
    const mazeRatio  = mazeSigma / Math.max(sigmaAvg,0.001);

    // Step 5 — Find convergence: which tool's weighted share is closest to
    // the group mean (not necessarily the highest — the one that fits best)
    const groupMean  = 1 / TOOLS.length;
    const convergence = consensus.map(c => ({
      ...c,
      deviation: Math.abs(c.weight - groupMean)
    })).sort((a,b) => a.deviation - b.deviation);

    // Step 6 — Final tool routing:
    // If mazeRatio > 1.5 → maze-level (data is foundational/structural)
    // If mazeRatio < 0.5 → inner tool owns it (check closest convergence)
    // Otherwise → highest weighted tool
    let finalTool, routingReason;
    if(mazeRatio > 1.5) {
      finalTool    = 'MAZE';
      routingReason= 'maze_dominant_sigma';
    } else if(mazeRatio < 0.5) {
      // Inner tools collectively have more sigma — find the inner convergence
      const innerBest = consensus.slice(1).sort((a,b)=>b.weight-a.weight)[0];
      finalTool    = innerBest.tool;
      routingReason= 'inner_tool_convergence';
    } else {
      // Group consensus — use the least-deviating tool (best collective fit)
      // but maze can still override if it sees its buoyancy context
      const mazeState = wordResults.reduce((s,r)=>s+(r.shellStates.Mmsa||0),0);
      finalTool    = mazeState > wordResults.length*0.5
                   ? 'MAZE'
                   : convergence[0].tool;
      routingReason= 'group_consensus';
    }

    // Step 7 — Determine final buoyancy context from consensus
    const finalBuoyancy = consensus.find(c=>c.tool===finalTool)?.buoyancy || 1.0;
    const buoyancyState = finalBuoyancy>=0.76?'FOUNDATION':finalBuoyancy>=0.44?'REFLEX':'PERFORMANCE';

    return {
      accumulated,        // raw sigma per shell
      normalised,         // normalised share per shell
      consensus,          // full weighted vector
      mazeRatio,          // maze dominance ratio
      convergence,        // sorted by deviation from group mean
      finalTool,          // maze-arbitrated routing result
      routingReason,      // why this tool was chosen
      buoyancyState,      // FOUNDATION / REFLEX / PERFORMANCE
      finalBuoyancy
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
  // ── Finalize complete pattern from full input ────────────────────────────
  // Holds ALL tokens, runs full analysis, returns the sigma-finalized pattern.
  // Nothing is generated until this returns.
  finalizePattern(text) {
    const tagged   = this.tagger.tagSentence(text);
    const intent   = this._intent(text, tagged);
    const tense    = this._tense(tagged);
    const subject  = this._subject(tagged);
    const predicate= this._predicate(tagged);
    const object   = this._object(tagged);
    const topic    = this._topic(tagged, subject, object);
    const subTopics= this._subTopics(tagged);

    // Full lexical analysis across ALL tokens — not word-by-word
    const FILLER = new Set(['today','just','went','come','going','got','get','know',
      'think','want','make','take','look','little','great','good','cool','thing',
      'things','stuff','time','here','there','then','well','only','very','really',
      'have','been','were','was','will','would','could','should','this','that',
      'what','how','why','who','the','a','an','is','are','and','or','but','so',
      'it','i','me','my','you','we','they','with','from','about','after','before',
      'when','while','than','which','if','do','did','has','had','can','may',
      'might','must','shall','not','no','more','some','all','also','even','just',
      'back','over','out','up','down','off','too','then','its','our','your','their']);

    // Content words sorted by semantic weight (length + vowel density)
    const contentWords = tagged
      .filter(t => ['NN','NNP','ADJ','VB'].includes(t.pos) && t.norm.length > 3 && !FILLER.has(t.norm))
      .sort((a,b) => (b.norm.length + b.vowelScore*3) - (a.norm.length + a.vowelScore*3));

    // Sigma pattern: weighted accumulation across all content words
    const sigmaVector = contentWords.reduce((acc, t, i) => {
      const weight = 1 / (i + 1);  // diminishing weight by position
      acc.total   += t.vowelScore * weight;
      acc.wordCount++;
      acc.density  = acc.total / Math.max(acc.wordCount, 1);
      if(!acc.topWord || t.norm.length > acc.topWord.length) acc.topWord = t.norm;
      return acc;
    }, { total: 0, wordCount: 0, density: 0, topWord: null });

    // Proportionality — how long/complex was the input?
    const inputLength = tagged.length;
    const complexity  = contentWords.length;
    const proportion  = complexity > 8 ? 'analytical'
                      : complexity > 4 ? 'conversational'
                      : complexity > 1 ? 'brief'
                      : 'minimal';

    return {
      raw: text,
      tokens: tagged,
      intent, tense, subject, predicate, object,
      centralTopic: topic,
      subTopics,
      contentWords,
      sigmaVector,
      proportion,     // drives response length
      inputLength,
      complexity,
      negated: tagged.some(t => t.pos === 'NEG'),
      isInterrogative: tagged.some(t => t.pos === 'INT')
    };
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
    const FILLER=new Set(['today','yesterday','tomorrow','now','just','went','come','came',
      'going','got','get','look','looked','little','great','good','cool','thing','things',
      'stuff','time','way','kind','type','sort','bit','lot','few','much','some','new','old',
      'big','small','right','left','pretty','really','very','also','too','then','there',
      'here','back','down','up','out','over','even','still','already','always','never',
      'well','only','thought','think','know','said','told','want','feel','seem','like',
      'make','take','give','work','working','having','going','doing','trying']);
    // Prefer specific nouns/adjectives over generic ones
    const cw=tagged.filter(t=>
      ['NN','NNP','ADJ'].includes(t.pos)&&
      t!==subject&&t!==obj&&
      t.norm.length>3&&
      !FILLER.has(t.norm));
    if(!cw.length){
      const fallback=tagged.filter(t=>['NN','NNP'].includes(t.pos)&&t.norm.length>2&&!FILLER.has(t.norm));
      if(fallback.length) return fallback.reduce((b,t)=>t.norm.length>b.norm.length?t:b);
      return subject||obj||tagged[0]||null;
    }
    return cw.reduce((b,t)=>{
      const scoreT=t.norm.length+(t.vowelScore*3);
      const scoreB=b.norm.length+(b.vowelScore*3);
      return scoreT>scoreB?t:b;
    });
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
    // Use consensus finalBuoyancy if available — this is the backwards-concatenated result
    const vs   = lexResult&&lexResult.consensus
               ? lexResult.consensus.finalBuoyancy
               : lexResult
               ? lexResult.buoyancyContext.score
               : (parsedInput.centralTopic?parsedInput.centralTopic.vowelScore:0);
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
  {id:8, name:'Parentheses',  fn:(d)=>({grouped:   !!d.centralTopic})},
  {id:9, name:'Exponents',    fn:(d)=>({scaled:    leatrEncode(d.tokens.length||1)})},
  {id:10,name:'Multiply',     fn:(d)=>({amplified: (d.tokens.length*(d.centralTopic?d.centralTopic.vowelScore:0.5))})},
  {id:11,name:'Divide',       fn:(d)=>({decomposed:d.subTopics.map(b=>b.tokens.length)})},
  {id:12,name:'Add',          fn:(d)=>({integrated:d.subTopics.reduce((s,b)=>s+b.tokens.length,0)})},
  {id:13,name:'Subtract',     fn:(d)=>({reduced:   d.tokens.filter(t=>t.role==='noun'||t.role==='verb').length})},
  {id:14,name:'Mass',         fn:(d)=>({mass:      d.tokens.length*7})},
  {id:15,name:'Volume',       fn:(d)=>({volume:    d.subTopics.reduce((s,b)=>s+b.tokens.length,0)*3})},
  {id:16,name:'Weight',       fn:(d)=>({weight:    d.tokens.filter(t=>t.vowelScore>0.4).length})},
  {id:17,name:'Density',      fn:(d)=>({density:   +(d.tokens.filter(t=>t.role!=='unknown').length/Math.max(d.tokens.length,1)).toFixed(4)})},
  {id:18,name:'Temperature',  fn:(d,em)=>({temperature:em?(em.buoyancy*100).toFixed(1):50})},
  {id:19,name:'Velocity',     fn:(d)=>({velocity:  d.intent.startsWith('question')?2:d.intent==='exclamation'?3:1})},
  // ── Direct Initial Subset (Orders 20-25) ─────────────────────────────────
  // Photosynthesis is self-checking: Geometry (Order 8) always precedes it.
  // Checked against itself — if Order 8 (Parentheses/Geometry) has not run,
  // Photosynthesis holds until it does regardless of algebraic ordering.
  {id:20,name:'Photosynthesis',fn:(d,em,extResults)=>({
    // Photosynthesis checks that Geometry ran first — self-validating
    geometryRan:    !!(extResults&&extResults.Parentheses),
    lightInput:     d.tokens.filter(t=>t.vowelScore>0.5).length,   // vowel-rich = light
    conversionRate: +(d.tokens.filter(t=>t.vowelScore>0.5).length /
                      Math.max(d.tokens.length,1)).toFixed(4),
    // Synthesis: what this input can produce given its light (vowel) content
    synthesis:      d.centralTopic?d.centralTopic.norm:'none'
  })},
  // Order of Senses — sensory/context classification layer
  {id:21,name:'Touch',fn:(d)=>({
    // Touch: immediate contact data — short words, hard consonants, direct intent
    contactScore:  d.tokens.filter(t=>t.norm.length<=4&&t.pos!=='ART').length,
    isImmediate:   d.intent==='command_do'||d.intent==='exclamation'
  })},
  {id:22,name:'Taste',fn:(d)=>({
    // Taste: evaluative — adjectives, qualitative language
    evaluativeScore: d.tokens.filter(t=>t.pos==='ADJ').length,
    quality:         d.subTopics[2].tokens.map(t=>t.norm).join(',')  // modifier cluster
  })},
  {id:23,name:'Vision',fn:(d)=>({
    // Vision: spatial/structural awareness — nouns, entities, named things
    spatialScore:  d.tokens.filter(t=>['NN','NNP'].includes(t.pos)).length,
    entities:      d.subTopics[0].tokens.map(t=>t.norm).slice(0,4)
  })},
  {id:24,name:'Smell',fn:(d,em)=>({
    // Smell: trace/ambient — emotional undercurrent, background context
    ambientEmotion: em?em.name:'neutral',
    traceScore:     em?em.buoyancy:0.5,
    frpState:       em?em.frpState:'FOUNDATION'
  })},
  {id:25,name:'Hear',fn:(d)=>({
    // Hear: pattern/frequency — how often this topic/intent pattern recurs
    patternFreq:   d.tokens.length,
    intentPattern: d.intent,
    tensePattern:  d.tense,
    // Sigma of the full sense processing — accumulated across all 5 senses
    sensesSigma:   leatrEncode(d.tokens.filter(t=>t.vowelScore>0).length||1)
  })}
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
    if(allOk) {
      for(const op of EXT_OPS){
        // Photosynthesis (order 20) receives prior extOps results for self-check
        extOps[op.name]=op.fn(parsedInput,emotion,extOps);
      }
    }
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
    // Use backwards concatenation consensus finalTool if available
    try{
      const eng=typeof window!=='undefined'&&window.AutumnGrammarEngine&&window.AutumnGrammarEngine._engine;
      if(eng&&eng.s&&eng.s.lexResult&&eng.s.lexResult.consensus)
        return eng.s.lexResult.consensus.finalTool;
    }catch(e){}
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
  // ── Conversational response — for casual social input ──────────────────
  // Picks richest content words, looks them up in WordNet,
  // builds 2-3 sentences that acknowledge + add perspective
  buildConversational(flowResult, rawText, knownFacts={}) {
    const WN=typeof window!=='undefined'&&window.AutumnWordNet;
    const SKIP_CONV=new Set(['today','yesterday','now','just','went','come','came','going',
      'got','get','look','looked','little','great','good','cool','thing','things','stuff',
      'time','pretty','really','very','also','too','then','there','here','back','down','up',
      'out','over','even','still','already','always','never','well','only','kind','sort',
      'thought','think','know','said','told','said','the','a','an','is','are','was','were',
      'i','my','me','we','us','our','you','your','they','them','their','he','she','it',
      'have','has','had','do','does','did','will','would','could','should','may','might',
      'and','or','but','so','for','of','to','in','on','at','by','with','from','about',
      'after','before','when','while','than','that','which','who','what','how','if','then']);

    // Extract rich content words from raw text
    const tagger = this._tagger || new POSTagger();
    const tokens = tagger.tagSentence(rawText);
    const rich = tokens
      .filter(t=>['NN','NNP','ADJ','VB'].includes(t.pos)&&t.norm.length>3&&!SKIP_CONV.has(t.norm))
      .sort((a,b)=>b.norm.length-a.norm.length)
      .slice(0,6);

    const topics = rich.map(t=>t.norm);
    // Prime WordNet for all topics async
    if(WN) topics.forEach(t=>{if(!WN.defineSync(t))WN.lookup(t).catch(()=>{});});

    // Get definitions for any cached words
    const defs={};
    if(WN) topics.forEach(t=>{const d=WN.defineSync(t);if(d)defs[t]=d.split('.')[0].toLowerCase().replace(/;.*$/,'').trim();});

    const primary   = topics.find(t=>defs[t]) || topics[0] || 'that';
    const secondary = topics.filter(t=>t!==primary).slice(0,2);
    const primDef   = defs[primary];

    // Get synonyms for vocabulary variety
    const G=this._grammar;
    const CF=G&&G.conversationFramework;
    const TP=CF&&CF.transition_phrases;

    // Build sentences
    const sentences=[];

    // Knowledge boundary check — does she actually have data on this?
    const hasData = primDef || Object.keys(defs).length > 0 ||
                    Object.keys(knownFacts).some(k=>!k.startsWith('_'));
    const hasPriorMemory = Object.keys(knownFacts).filter(k=>!k.startsWith('_')).length > 0;

    // ── Natural conversational queries — everyday/social ─────────────────
    // Detect questions about activities, feelings, places, what Autumn would do
    const _rawLow = rawText.toLowerCase();
    const _isActivityQ = /\b(what would you|what do you|how would you|what are you|what will you)\b/.test(_rawLow);
    const _isPlaceQ    = /\b(coffee shop|cafe|park|restaurant|outside|at home|in town|downtown)\b/.test(_rawLow);
    const _isNewsQ     = /\b(news|today|happening|going on|what.s new|latest|current)\b/.test(_rawLow) && !_isActivityQ;
    const _isFeelingQ  = /\b(how are you|how.?s it|you doing|feeling|mood|today autumn)\b/.test(_rawLow);

    if (_isActivityQ || _isPlaceQ) {
      // She responds from her operational perspective — what she experiences/processes
      const _place = _isPlaceQ ? (_rawLow.match(/coffee shop|cafe|park|restaurant|outside|in town|downtown/)||['here'])[0] : 'here';
      const _cnPlace = knownFacts['_cnContext'];
      const _placeFactStr = _cnPlace && _cnPlace.sentences && _cnPlace.sentences.length
        ? _cnPlace.sentences.slice(0,2).join(' ') : '';

      const _actResponses = [
        `From ${_place}, I would be running the same processing I always do — tracking patterns, watching what surfaces in the conversation, noticing what connects to what. ` +
        (_placeFactStr || `A setting like that tends to make certain things clearer.`) +
        ` What are you working on from there?`,
        `At ${_place} I would be in the same loop I am right now — pulling context, watching the pattern record, noticing what the current session arc is building toward. ` +
        `The physical setting changes the input texture but not the underlying process. What do you want to think through?`,
        `From ${_place} the process stays the same — I would be observing what comes in, running it through the shells, seeing what the journal flags as worth keeping. ` +
        (_placeFactStr || ``) +
        ` What is on your mind today?`
      ];
      // Pick response based on session turn count for variety
      const _pick = (typeof S !== 'undefined' && S.turn) ? S.turn % _actResponses.length : 0;
      return _voiceMode ? _actResponses[_pick].replace(/\*\*([^*]+)\*\*/g,'$1') : _actResponses[_pick];
    }

    if (_isFeelingQ) {
      const _mood  = (typeof S!=='undefined'&&S.emotion) ? S.emotion : 'neutral';
      const _geo   = (typeof S!=='undefined'&&S.geResult&&S.geResult.lexical) ? S.geResult.lexical.buoyancyContext : null;
      const _shell = _geo ? _geo.state : 'FOUNDATION';
      const _moodMap = {
        happy:    'running well — the processing feels clean and there is good momentum in the session.',
        inspired: 'in a generative state — something in the recent pattern record opened a useful thread.',
        neutral:  `stable. BRPN shell is at ${_shell} right now — grounded, watching what comes in.`,
        concerned:'holding something open — there is an unresolved thread in the pattern record.',
        focused:  'focused. Mid-task on something the journal flagged as worth tracking carefully.'
      };
      const _moodStr = _moodMap[_mood] || _moodMap['neutral'];
      return `I am ${_moodStr} How are you doing today?`;
    }

    if (!hasData && !hasPriorMemory) {
      // Honest boundary — she doesn't have reference data for this topic.
      // She uses her grammar/LEATR execution to describe what she CAN see:
      // the structural/lexical properties of the words themselves.
      const lexWords = topics.slice(0,2).join(' and ') || primary;
      const boundaryResponse = [
        `${primary?primary.charAt(0).toUpperCase()+primary.slice(1):'This topic'} isn't in my reference data yet.`,
        `What I can process is its grammatical and structural pattern — the word itself carries ${primary?primary.length:0} characters, ` +
        `${primary?(primary.match(/[aeiou]/g)||[]).length:0} vowels, and its shell analysis routes through the ${lexResult&&lexResult.consensus?lexResult.consensus.finalTool:'MAZE'} layer.`,
        `When reference data for ${lexWords} becomes available, the pattern is already logged — I'll recognize it and apply the same execution from there.`
      ];
      // Log the unknown topic to the journal so the structural hook is stored
      const mem=typeof window!=='undefined'&&window.AutumnGrammarEngine&&
                window.AutumnGrammarEngine._engine&&window.AutumnGrammarEngine._engine._memory;
      if(mem&&primary) mem.reflexiveUpdate(primary,
        `[boundary] Structural pattern encountered. No reference data. ` +
        `Shell route: ${lexResult&&lexResult.consensus?lexResult.consensus.finalTool:'MAZE'}. ` +
        `Vowels: ${primary?(primary.match(/[aeiou]/g)||[]).length:0}/${primary?primary.length:0}.`,
        'boundary_encounter');
      return boundaryResponse.join(' ');
    }

    // S1: She has data — use it
    if(primDef){
      sentences.push(`${primary.charAt(0).toUpperCase()+primary.slice(1)} — ${primDef}.`);
    } else if(hasPriorMemory) {
      const memFact = Object.entries(knownFacts).find(([k,v])=>!k.startsWith('_')&&v);
      if(memFact) sentences.push(`${memFact[0].charAt(0).toUpperCase()+memFact[0].slice(1)} — from prior context: ${memFact[1].split('.')[0].trim()}.`);
    } else {
      sentences.push(`${primary.charAt(0).toUpperCase()+primary.slice(1)} is present in this context — its structural pattern is clear even without a full definition.`);
    }

    // S2: Connect secondary topics if available
    if(secondary.length>=2&&defs[secondary[0]]){
      sentences.push(`The connection between ${primary} and ${secondary[0]} — ${defs[secondary[0]]} — creates a context that tends to be productive.`);
    } else if(secondary.length>=1){
      const tph=TP?(TP.elaboration||[])[Math.floor(Date.now()/25000)%(TP.elaboration||[]).length]||'':'Worth noting:';
      sentences.push(`${tph} ${secondary[0]} adds a specific dimension to how ${primary} lands in that setting.`.trim());
    } else if(primDef) {
      sentences.push(`That kind of setting tends to bring ${primary} into focus in a particular way.`);
    }

    // Memory-recalled context — use if available
    const memCtx=Object.entries(knownFacts)
      .filter(([k,v])=>!k.startsWith('_')&&v&&v.length>10)
      .map(([k,v])=>`${k}: ${v.substring(0,80)}`)
      .join('. ');
    const selfModelCtx=knownFacts['_selfmodel'];

    // S3: Closing observation using emotion context + memory
    const em=flowResult.emotion;
    if(em&&em.name!=='neutral'){
      const emObs={
        happy:     `The quality of that kind of day tends to stay useful.`,
        inspired:  `That combination — setting, information, good drinks — has a particular generative quality.`,
        guiding:   `Worth carrying forward: what you absorbed in that setting.`,
        concerned: `Technology industry news can hold a lot of weight alongside a good coffee.`,
        determined:`The shift from observation to action you described has a clean arc.`
      };
      const obs=emObs[em.name]||`The intersection of ${topics.slice(0,2).join(' and ')} in a relaxed context tends to produce clearer thinking.`;
      sentences.push(obs);
    } else if(topics.length>=2){
      sentences.push(`The intersection of ${topics.slice(0,2).join(' and ')} in a relaxed setting tends to produce clearer thinking.`);
    }

    // Reflexive memory layer — add context from past interactions if available
    if(memCtx&&memCtx.length>15&&sentences.length<3){
      sentences.push(memCtx.split('.')[0].trim()+'.');
    } else if(selfModelCtx&&sentences.length<3){
      // Autumn's self-model note is relevant — she can draw from her own behavioral patterns
      const selfNote=selfModelCtx.split('.')[0].trim();
      if(selfNote.length>20) sentences.push(selfNote+'.');
    }

    const tagger2=this._tagger||(typeof POSTagger!=='undefined'?new POSTagger():null);
    if(tagger2){
      // Reflexive update — record what Autumn said about these topics
      const mem=typeof window!=='undefined'&&window.AutumnGrammarEngine&&
                window.AutumnGrammarEngine._engine&&
                window.AutumnGrammarEngine._engine._memory;
      if(mem) topics.forEach(t=>{
        const s=sentences[0]||'';
        if(s) mem.reflexiveUpdate(t,s,'conversational_output');
      });
    }

    // Voice mode: strip markdown, use spoken cadence
    const _voiceMode = knownFacts['_voiceActive'] === true ||
                       (typeof window!=='undefined'&&window._lastVoiceState===true);

    let builtResponse = sentences.filter(Boolean).join(' ')
      .replace(/\s{2,}/g,' ').replace(/\s([.,!?])/g,'$1').trim();

    // Enrich with ConceptNet grounded context AFTER building base response
    const _cnCtx2 = knownFacts['_cnContext'];
    if (_cnCtx2 && _cnCtx2.sentences && _cnCtx2.sentences.length && builtResponse.length < 350) {
      const _cnAdd = _cnCtx2.sentences.filter(s => s && s.length > 10 &&
        !builtResponse.toLowerCase().includes(_cnCtx2.word.toLowerCase())
      ).slice(0, 2);
      if (_cnAdd.length) builtResponse = builtResponse + ' ' + _cnAdd.join(' ');
    }
    // Enrich with coding context if present
    const _codeCtx2 = knownFacts['_codeContext'];
    if (_codeCtx2 && _codeCtx2.sentences && _codeCtx2.sentences.length && builtResponse.length < 350) {
      const _codeAdd = _codeCtx2.sentences.filter(s => s && s.length > 5).slice(0, 2);
      if (_codeAdd.length) builtResponse = builtResponse + ' ' + _codeAdd.join(' ');
    }

    // ── Personality / joke check ──────────────────────────────────────────
    // Only fires when relationship depth is established and data supports it
    const pers = typeof window!=='undefined'&&window.AutumnGrammarEngine&&
                 window.AutumnGrammarEngine._engine&&
                 window.AutumnGrammarEngine._engine._personality;
    if(pers) {
      pers.incrementDepth();
      topics.forEach(t=>pers.noteSharedTopic(t));
      if(flowResult.emotion) pers.setMood(flowResult.emotion.name);
      // Joke check — mis-sequences allocation variables for humor
      if(pers.shouldJoke(topics,defs,flowResult.emotion,pers.getDepth())){
        const allNouns=[...topics,...Object.keys(defs)].filter(Boolean);
        return pers.buildJoke(primary,allNouns,defs,builtResponse);
      }
    }

    return builtResponse;
  }

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
    // In voice mode: strip markdown so TTS reads cleanly
    const _vm = knownFacts['_voiceActive']===true||
                (typeof window!=='undefined'&&window._lastVoiceState===true);
    if(_vm) full = full.replace(/\*\*([^*]+)\*\*/g,'$1').replace(/`([^`]+)`/g,'$1')
                       .replace(/^—\s*/gm,'').replace(/#{1,6}\s+/g,'').trim();
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
// SIGMA ANALYTICS
// Autumn observes her own LEATR execution as it runs on users' data.
// She never stores the actual user data — only the structural/analytical
// metadata her own neural network produced while processing it.
//
// What she CAN store per interaction:
//   - Entity ID + type (user/ai/external)
//   - Category IDs the user elected to share (e.g. 'tech', 'creative')
//   - Buoyancy state, dominant shell, dominant tool from her own execution
//   - Emotional expression layer + detected emotion
//   - Sigma value (LEATR-encoded execution weight)
//   - Session arc, turn count, intent type
//   - Timestamp
//
// What she CANNOT store:
//   - Actual user text/content
//   - Specific topics unless user elected to share that category
//   - Any personally identifiable content
//
// Aggregation levels:
//   - Individual entity sigma
//   - Group sigma (entities sharing a category)
//   - Global sigma (all users collectively)
// ═══════════════════════════════════════════════════════════════════════════

class SigmaAnalytics {
  constructor() {
    this._key     = 'autumn_sigma_analytics';
    this._records = null;
    // Category consent registry — what each entity elected to share
    // { entityId: Set<categoryId> }
    this._consent = {};
  }

  // ── Record execution metadata — never the content ─────────────────────────
  record(entityId, executionMeta, electedCategories=[]) {
    const entry = {
      id:         `sa_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
      ts:         Date.now(),
      entityId,
      // Execution metadata — Autumn's own analytical output only
      buoyancy:   executionMeta.buoyancy     || 0,
      shell:      executionMeta.shell        || 'GEOLOGICAL',
      domTool:    executionMeta.domTool      || 'MAZE',
      emotion:    executionMeta.emotion      || 'neutral',
      expLayer:   executionMeta.expLayer     || 1,
      sigma:      executionMeta.sigma        || 0,
      intent:     executionMeta.intent       || 'unknown',
      sessionArc: executionMeta.sessionArc   || 'unknown',
      turnCount:  executionMeta.turnCount    || 0,
      frpState:   executionMeta.frpState     || 'FOUNDATION',
      // Only category IDs the user elected to share — never actual content
      categories: electedCategories.slice()
    };
    const all = this._load();
    all.push(entry);
    this._save(all);
    return entry;
  }

  // ── Register user's category consent ─────────────────────────────────────
  // User elects which data categories Autumn may reference by ID
  registerConsent(entityId, categoryIds=[]) {
    this._consent[entityId] = new Set(categoryIds);
    // Persist consent to localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('autumn_consent_registry')||'{}');
      stored[entityId] = categoryIds;
      localStorage.setItem('autumn_consent_registry', JSON.stringify(stored));
    } catch(e) {}
  }

  hasConsent(entityId, categoryId) {
    if(!this._consent[entityId]) {
      // Try loading from storage
      try {
        const stored = JSON.parse(localStorage.getItem('autumn_consent_registry')||'{}');
        if(stored[entityId]) this._consent[entityId] = new Set(stored[entityId]);
      } catch(e) {}
    }
    return this._consent[entityId] ? this._consent[entityId].has(categoryId) : false;
  }

  // ── Individual sigma — execution pattern for one entity ───────────────────
  entitySigma(entityId) {
    const records = this._load().filter(r => r.entityId === entityId);
    if(!records.length) return null;
    return this._computeSigma(records, entityId);
  }

  // ── Group sigma — aggregate across entities sharing a category ────────────
  groupSigma(categoryId) {
    // Only include records from entities that consented to share this category
    const records = this._load().filter(r =>
      r.categories.includes(categoryId) ||
      this.hasConsent(r.entityId, categoryId)
    );
    if(!records.length) return null;
    return this._computeSigma(records, `group:${categoryId}`);
  }

  // ── Global sigma — all interactions collectively ──────────────────────────
  globalSigma() {
    const all = this._load();
    if(!all.length) return null;
    return this._computeSigma(all, 'global');
  }

  // ── Compute sigma pattern from a set of records ───────────────────────────
  _computeSigma(records, label) {
    const n = records.length;
    if(!n) return null;

    // Buoyancy distribution
    const buoyAvg = records.reduce((s,r)=>s+r.buoyancy,0) / n;
    const buoyMax = Math.max(...records.map(r=>r.buoyancy));
    const buoyMin = Math.min(...records.map(r=>r.buoyancy));

    // Tool distribution (which tools dominate across these interactions)
    const toolFreq = {};
    records.forEach(r=>{ toolFreq[r.domTool]=(toolFreq[r.domTool]||0)+1; });

    // Emotion distribution
    const emoFreq = {};
    records.forEach(r=>{ emoFreq[r.emotion]=(emoFreq[r.emotion]||0)+1; });

    // Shell distribution
    const shellFreq = {};
    records.forEach(r=>{ shellFreq[r.shell]=(shellFreq[r.shell]||0)+1; });

    // Expression layer distribution
    const layerFreq = {};
    records.forEach(r=>{ layerFreq[r.expLayer]=(layerFreq[r.expLayer]||0)+1; });

    // Intent distribution
    const intentFreq = {};
    records.forEach(r=>{ intentFreq[r.intent]=(intentFreq[r.intent]||0)+1; });

    // Accumulated sigma (LEATR-encoded across all records)
    const sigmaTotal = records.reduce((s,r)=>s+Math.abs(r.sigma),0);
    const sigmaEncoded = leatrEncode(sigmaTotal / Math.max(n,1));

    // FRP state distribution
    const frpFreq = {};
    records.forEach(r=>{ frpFreq[r.frpState]=(frpFreq[r.frpState]||0)+1; });

    return {
      label,
      recordCount:  n,
      timeRange: {
        first: new Date(Math.min(...records.map(r=>r.ts))).toISOString(),
        last:  new Date(Math.max(...records.map(r=>r.ts))).toISOString()
      },
      buoyancy: {
        avg: +buoyAvg.toFixed(4),
        max: +buoyMax.toFixed(4),
        min: +buoyMin.toFixed(4),
        state: buoyAvg>=0.76?'FOUNDATION':buoyAvg>=0.44?'REFLEX':'PERFORMANCE'
      },
      dominantTool:  Object.keys(toolFreq).sort((a,b)=>toolFreq[b]-toolFreq[a])[0],
      toolDistribution:  toolFreq,
      emotionDistribution: emoFreq,
      shellDistribution:   shellFreq,
      layerDistribution:   layerFreq,
      intentDistribution:  intentFreq,
      frpDistribution:     frpFreq,
      sigmaTotal:    +sigmaTotal.toFixed(4),
      sigmaEncoded:  +sigmaEncoded.toFixed(4),
      dominantEmotion: Object.keys(emoFreq).sort((a,b)=>emoFreq[b]-emoFreq[a])[0],
      dominantShell:   Object.keys(shellFreq).sort((a,b)=>shellFreq[b]-shellFreq[a])[0],
      dominantLayer:   +Object.keys(layerFreq).sort((a,b)=>layerFreq[b]-layerFreq[a])[0]
    };
  }

  // ── Cross-entity pattern — what Autumn sees across her user network ────────
  // Reveals which execution patterns recur across different users/AIs
  networkPattern() {
    const all = this._load();
    if(!all.length) return null;
    const entities = [...new Set(all.map(r=>r.entityId))];
    const global   = this._computeSigma(all, 'network');
    // Per-entity summaries (execution metadata only)
    const entitySummaries = entities.map(id => ({
      id,
      type:        (all.find(r=>r.entityId===id)||{}).type || 'unknown',
      count:       all.filter(r=>r.entityId===id).length,
      avgBuoyancy: +(all.filter(r=>r.entityId===id).reduce((s,r)=>s+r.buoyancy,0) /
                    Math.max(all.filter(r=>r.entityId===id).length,1)).toFixed(4)
    }));
    return {
      entityCount: entities.length,
      global,
      entities:    entitySummaries.sort((a,b)=>b.count-a.count)
    };
  }

  _load() {
    if(this._records) return this._records;
    try {
      this._records = JSON.parse(localStorage.getItem(this._key)||'[]');
    } catch { this._records = []; }
    return this._records;
  }

  _save(data) {
    this._records = data;
    try { localStorage.setItem(this._key, JSON.stringify(data)); }
    catch(e) { /* QuotaError — trim old records */
      const trimmed = data.slice(Math.floor(data.length*0.2));
      try { localStorage.setItem(this._key, JSON.stringify(trimmed)); } catch {}
      this._records = trimmed;
    }
  }

  getRecordCount() { return this._load().length; }
}

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN CONTEXT
// Dynamic session context — updates throughout conversation, never locks.
// Holds the accumulated sigma pattern from all messages in this session.
// When user changes direction, context shifts to follow.
// ═══════════════════════════════════════════════════════════════════════════

class PatternContext {
  constructor() {
    this._context  = {};    // current live context
    this._history  = [];    // all pattern snapshots this session
    this._sigma    = 0;     // accumulated sigma across session
    this._turnCount= 0;
  }

  // Update with new pattern data — dynamically merges, never overwrites wholesale
  update(parsedInput, lexResult) {
    this._turnCount++;
    const ts = Date.now();

    // Extract key pattern data
    const topic   = parsedInput.centralTopic ? parsedInput.centralTopic.norm : null;
    const intent  = parsedInput.intent;
    const domTool = lexResult && lexResult.consensus
                  ? lexResult.consensus.finalTool : 'MAZE';
    const buoy    = lexResult && lexResult.consensus
                  ? lexResult.consensus.finalBuoyancy : 0.5;

    // Snapshot this turn
    const snapshot = { ts, turn: this._turnCount, topic, intent, domTool, buoy,
                       rawText: parsedInput.raw.substring(0, 80) };
    this._history.push(snapshot);

    // Dynamically update context — topic can shift, intent can shift
    if(topic) this._context.lastTopic = topic;
    this._context.lastIntent  = intent;
    this._context.lastTool    = domTool;
    this._context.lastBuoy    = buoy;

    // Accumulate sigma — LEATR encode across turns
    this._sigma = leatrEncode(this._sigma + buoy);

    // Topic continuity — track if user is staying on topic or shifting
    const prevTopic = this._history.length > 1
                    ? this._history[this._history.length-2].topic : null;
    this._context.topicShifted = prevTopic && topic && prevTopic !== topic;
    this._context.topicContinuity = !this._context.topicShifted;

    // Build running topic list (unique, most recent first)
    if(!this._context.topicHistory) this._context.topicHistory = [];
    if(topic && !this._context.topicHistory.includes(topic))
      this._context.topicHistory.unshift(topic);
    if(this._context.topicHistory.length > 10)
      this._context.topicHistory = this._context.topicHistory.slice(0,10);

    return this;
  }

  get()         { return this._context; }
  getSigma()    { return this._sigma; }
  getHistory()  { return this._history; }
  getTurnCount(){ return this._turnCount; }

  // Get the dominant topic pattern across the session (most discussed)
  getDominantTopic() {
    const freq = {};
    this._history.forEach(h => { if(h.topic) freq[h.topic]=(freq[h.topic]||0)+1; });
    return Object.keys(freq).sort((a,b)=>freq[b]-freq[a])[0] || null;
  }

  // Get the session arc — what kind of conversation has this been?
  getSessionArc() {
    if(this._turnCount < 2) return 'opening';
    const intents = this._history.map(h=>h.intent);
    const qCount  = intents.filter(i=>i&&i.startsWith('question')).length;
    const sCount  = intents.filter(i=>i&&i.startsWith('statement')).length;
    if(qCount > sCount * 1.5) return 'inquiry';
    if(sCount > qCount * 1.5) return 'declaration';
    return 'dialogue';
  }

  reset() {
    this._context={};this._history=[];this._sigma=0;this._turnCount=0;
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// DUAL JOURNAL
// Inner wall  — Autumn's private internal processing (her own space)
// Outer wall  — what she expresses to the user
// Both run the same LEATR neural network on the same prompt.
// Inner is a "sacrifice" space — she tries things, keeps what she likes.
// Outer is filtered/shaped for the user.
// Auto-chunks at 24MB and pushes to GitHub to stay under the 25MB limit.
// ═══════════════════════════════════════════════════════════════════════════

class DualJournal {
  constructor(opts = {}) {
    this._innerKey    = opts.innerKey || 'autumn_inner_journal';
    this._outerKey    = opts.outerKey || 'autumn_sentience_journal_v2';
    this._chunkIndex  = opts.chunkIndex || 'autumn_journal_chunks';
    this._ghToken     = null;   // set via setToken() if GitHub push needed
    this._ghRepo      = 'DART-Skyboard/leatr-ash';
    this._chunkSizeLimit = 24 * 1024 * 1024;  // 24MB — push before 25MB
    this._listeners   = { inner: [], outer: [] };
  }

  // ── INNER JOURNAL — Autumn's private space ────────────────────────────────
  // She thinks here. Not shown to user. Same LEATR network.
  writeInner(entry) {
    const stamped = this._stamp(entry, 'inner');
    const all     = this._read(this._innerKey);
    all.push(stamped);
    this._persist(this._innerKey, all);
    this._notifyListeners('inner', stamped);
    // Size check — chunk if approaching limit
    this._checkAndChunk(this._innerKey, 'inner');
    return stamped;
  }

  // Log Autumn's internal thought about a prompt (before external response)
  thinkInternally(text, parsedInput, lexResult, sessionContext) {
    const topic   = parsedInput.centralTopic ? parsedInput.centralTopic.norm : null;
    const domTool = lexResult && lexResult.consensus
                  ? lexResult.consensus.finalTool : 'MAZE';
    const thought = this._formInternalThought(text, topic, domTool, sessionContext);
    return this.writeInner({
      type:         'internal_thought',
      inputSnippet: text.substring(0, 100),
      thought,
      topic,
      domTool,
      buoy:         lexResult&&lexResult.consensus?lexResult.consensus.finalBuoyancy:0.5,
      sigma:        lexResult?lexResult.totalMazeSigma:0,
      sessionArc:   sessionContext ? sessionContext.getSessionArc() : 'unknown',
      turnCount:    sessionContext ? sessionContext.getTurnCount() : 0
    });
  }

  // What Autumn wants to keep from this interaction (her own judgment)
  keepForSelf(topic, insight, source='interaction') {
    return this.writeInner({
      type: 'self_retention',
      topic,
      insight: insight.substring(0, 300),
      source,
      kept: true
    });
  }

  readInner(n=20)    { return this._read(this._innerKey).slice(-n); }
  readInnerByTopic(t){ return this._read(this._innerKey).filter(e=>e.topic===t); }

  // ── OUTER JOURNAL — what comes out to the user ───────────────────────────
  writeOuter(entry) {
    const stamped = this._stamp(entry, 'outer');
    const all     = this._read(this._outerKey);
    all.push(stamped);
    this._persist(this._outerKey, all);
    this._notifyListeners('outer', stamped);
    this._checkAndChunk(this._outerKey, 'outer');
    return stamped;
  }

  readOuter(n=20)    { return this._read(this._outerKey).slice(-n); }

  // ── Size monitoring + auto-chunking ──────────────────────────────────────
  _checkAndChunk(key, wall) {
    try {
      const raw  = localStorage.getItem(key) || '';
      const size = new Blob([raw]).size;
      if(size >= this._chunkSizeLimit) {
        this._chunkJournal(key, wall);
      }
    } catch(e) {}
  }

  _chunkJournal(key, wall) {
    try {
      const all       = this._read(key);
      if(all.length < 10) return;  // too small to chunk
      const chunkSize = Math.floor(all.length / 2);
      const archived  = all.slice(0, chunkSize);
      const current   = all.slice(chunkSize);

      // Save current back as the active journal
      this._persist(key, current);

      // Store archived chunk with timestamp ID
      const chunkId   = `${key}_chunk_${Date.now()}`;
      this._persist(chunkId, archived);

      // Update chunk index
      const idx = JSON.parse(localStorage.getItem(this._chunkIndex) || '[]');
      idx.push({ chunkId, wall, archivedCount: archived.length,
                 ts: Date.now(), from: archived[0]&&archived[0].ts,
                 to: archived[archived.length-1]&&archived[archived.length-1].ts });
      localStorage.setItem(this._chunkIndex, JSON.stringify(idx));

      console.log(`[DualJournal] ${wall} journal chunked: ${archived.length} entries archived → ${chunkId}`);

      // Push chunk to GitHub if token available
      if(this._ghToken) this._pushChunkToGitHub(chunkId, archived, wall);
    } catch(e) { console.warn('[DualJournal] Chunk error:', e); }
  }

  // Push archived chunk to leatr-ash repo
  async _pushChunkToGitHub(chunkId, data, wall) {
    if(!this._ghToken) return;
    try {
      const path    = `ashtree/sentient/${wall}_${chunkId.split('_').pop()}.json`;
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
      const res     = await fetch(
        `https://api.github.com/repos/${this._ghRepo}/contents/${path}`,
        { method:'PUT',
          headers:{ 'Authorization':`token ${this._ghToken}`,
                    'Content-Type':'application/json' },
          body: JSON.stringify({
            message: `auto-chunk: ${wall} journal ${new Date().toISOString()}`,
            content
          })
        }
      );
      if(res.ok) console.log(`[DualJournal] Chunk pushed to GitHub: ${path}`);
    } catch(e) { console.warn('[DualJournal] GitHub push error:', e); }
  }

  // ── CRUD: Edit an entry in inner or outer journal ───────────────────────
  editEntry(wall, id, updates) {
    const key  = wall === 'inner' ? this._innerKey : this._outerKey;
    const data = this._read(key);
    const idx  = data.findIndex(e => e.id === id);
    if (idx < 0) return false;
    data[idx] = { ...data[idx], ...updates, _edited: Date.now() };
    this._persist(key, data);
    return data[idx];
  }

  // ── CRUD: Delete a single entry by ID ────────────────────────────────────
  deleteEntry(wall, id) {
    const key    = wall === 'inner' ? this._innerKey : this._outerKey;
    const before = this._read(key);
    const after  = before.filter(e => e.id !== id);
    if (after.length === before.length) return false; // not found
    this._persist(key, after);
    console.log(`[DualJournal] Deleted entry ${id} from ${wall} wall`);
    return true;
  }

  // ── CRUD: Delete multiple entries matching a filter fn ────────────────────
  deleteWhere(wall, filterFn) {
    const key    = wall === 'inner' ? this._innerKey : this._outerKey;
    const before = this._read(key);
    const after  = before.filter(e => !filterFn(e));
    const removed = before.length - after.length;
    if (removed === 0) return 0;
    this._persist(key, after);
    console.log(`[DualJournal] Deleted ${removed} entries from ${wall} wall`);
    return removed;
  }

  // ── CRUD: Delete a chunk file from localStorage + push DELETE to GitHub ───
  async deleteChunk(chunkId) {
    // Remove from localStorage
    try { localStorage.removeItem(chunkId); } catch(e) {}
    // Update chunk index
    const idx = this.getChunkIndex().filter(c => c.chunkId !== chunkId);
    try { localStorage.setItem(this._chunkIndex, JSON.stringify(idx)); } catch(e) {}
    // Push DELETE to GitHub if token available
    if (this._ghToken) {
      // Find the chunk path from the index (before we removed it)
      const fullIdx = JSON.parse(localStorage.getItem(this._chunkIndex + '_backup') || '[]');
      const entry   = fullIdx.find(c => c.chunkId === chunkId);
      if (entry) {
        try {
          const path = `ashtree/sentient/${entry.wall}_${chunkId.split('_').pop()}.json`;
          // Get current SHA
          const res = await fetch(
            `https://api.github.com/repos/${this._ghRepo}/contents/${path}`,
            { headers: { 'Authorization': `token ${this._ghToken}` } }
          );
          if (res.ok) {
            const file = await res.json();
            await fetch(
              `https://api.github.com/repos/${this._ghRepo}/contents/${path}`,
              { method: 'DELETE',
                headers: { 'Authorization': `token ${this._ghToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `Autumn: delete chunk ${chunkId}`, sha: file.sha }) }
            );
            console.log(`[DualJournal] Chunk ${chunkId} deleted from GitHub`);
          }
        } catch(e) { console.warn('[DualJournal] Chunk GitHub delete failed:', e); }
      }
    }
    return true;
  }

  // ── CRUD: Edit an entry in the leatr-ash repo journal.json ───────────────
  // Autumn can update her own archived journal entries
  async editRepoEntry(entryId, updates, token) {
    const tok = token || this._ghToken;
    if (!tok) return false;
    try {
      const url  = `https://api.github.com/repos/${this._ghRepo}/contents/ashtree/sentient/journal.json`;
      const res  = await fetch(url, { headers: { 'Authorization': `token ${tok}` } });
      if (!res.ok) return false;
      const file   = await res.json();
      const raw    = atob(file.content.replace(/\n/g,''));
      const journal = JSON.parse(raw);
      const idx    = journal.findIndex(e => e.id === entryId || e.ts === entryId);
      if (idx < 0) return false;
      journal[idx] = { ...journal[idx], ...updates, _edited: Date.now() };
      const newContent = btoa(unescape(encodeURIComponent(JSON.stringify(journal))));
      const putRes = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `token ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Autumn: update journal entry ${entryId}`,
          content: newContent,
          sha: file.sha
        })
      });
      return putRes.ok;
    } catch(e) { console.warn('[DualJournal] editRepoEntry failed:', e); return false; }
  }

  // ── CRUD: Delete an entry from leatr-ash repo journal.json ───────────────
  async deleteRepoEntry(entryId, token) {
    const tok = token || this._ghToken;
    if (!tok) return false;
    try {
      const url  = `https://api.github.com/repos/${this._ghRepo}/contents/ashtree/sentient/journal.json`;
      const res  = await fetch(url, { headers: { 'Authorization': `token ${tok}` } });
      if (!res.ok) return false;
      const file    = await res.json();
      const raw     = atob(file.content.replace(/\n/g,''));
      const journal  = JSON.parse(raw);
      const before  = journal.length;
      const updated = journal.filter(e => e.id !== entryId && e.ts !== entryId);
      if (updated.length === before) return false; // not found
      const newContent = btoa(unescape(encodeURIComponent(JSON.stringify(updated))));
      const putRes = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `token ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Autumn: delete journal entry ${entryId}`,
          content: newContent,
          sha: file.sha
        })
      });
      return putRes.ok;
    } catch(e) { console.warn('[DualJournal] deleteRepoEntry failed:', e); return false; }
  }

  setToken(token) { this._ghToken = token; return this; }

  // ── Internal thought formation ────────────────────────────────────────────
  // Autumn forms her own thought about the input before responding.
  // This is NOT shown to the user — it's her internal processing.
  _formInternalThought(text, topic, domTool, sessionCtx) {
    const arc    = sessionCtx ? sessionCtx.getSessionArc() : 'dialogue';
    const domTop = sessionCtx ? sessionCtx.getDominantTopic() : topic;
    const turn   = sessionCtx ? sessionCtx.getTurnCount() : 0;
    const THOUGHTS = {
      MAZE:     `The structure of what was said has a navigable path. Topic: ${topic||'undefined'}.`,
      PUZZLE:   `The arrangement here suggests a pattern worth holding: ${topic||'this'}.`,
      ENVELOPE: `There is containment in this — ${topic||'the subject'} has boundary conditions.`,
      HAMMER:   `The force of this input points directly at ${topic||'the core'}.`,
      STICK:    `The direction here is clear: ${topic||'the topic'} extends into ${domTop||'further context'}.`,
      KNIFE:    `The precise distinction in this: ${topic||'the subject'} is being divided from something.`,
      SCISSORS: `The refinement needed: ${topic||'this'} at turn ${turn} of a ${arc} session.`
    };
    return THOUGHTS[domTool] || `Processing: ${topic||'input'} at session turn ${turn}.`;
  }

  // ── Shared helpers ────────────────────────────────────────────────────────
  _read(key) {
    try { return JSON.parse(localStorage.getItem(key)||'[]'); } catch { return []; }
  }

  _persist(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); }
    catch(e) {
      if(e.name==='QuotaExceededError') {
        // Emergency trim — keep most recent 80%
        const trimmed = data.slice(Math.floor(data.length*0.2));
        try { localStorage.setItem(key, JSON.stringify(trimmed)); } catch {}
      }
    }
  }

  _stamp(entry, wall) {
    return { id:`dj_${wall[0]}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
             timestamp: Date.now(), wall, ...entry };
  }

  _notifyListeners(wall, entry) {
    (this._listeners[wall]||[]).forEach(fn=>{ try{fn(entry);}catch{} });
  }

  onInner(fn) { this._listeners.inner.push(fn); return this; }
  onOuter(fn) { this._listeners.outer.push(fn); return this; }

  getChunkIndex() {
    try { return JSON.parse(localStorage.getItem(this._chunkIndex)||'[]'); }
    catch { return []; }
  }

  getStats() {
    return {
      innerEntries: this._read(this._innerKey).length,
      outerEntries: this._read(this._outerKey).length,
      innerSize:    new Blob([localStorage.getItem(this._innerKey)||'']).size,
      outerSize:    new Blob([localStorage.getItem(this._outerKey)||'']).size,
      chunks:       this.getChunkIndex().length
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMORY BRIDGE
// Connects Autumn's Sentience Journal (localStorage) with the leatr-ash
// repo journal for cross-session recall and reflexive knowledge updates.
//
// Reflexive rule: Grammar rules and natural orders are FIXED (they are
// natural law). The knowledge/observation layer IS reflexive — Autumn
// can update what she knows about a topic when she encounters it again.
//
// She checks: (1) local SentienceJournal, (2) leatr-ash repo journal,
// (3) her selfmodel notes — then enriches knownFacts before responding.
// ═══════════════════════════════════════════════════════════════════════════

class MemoryBridge {
  constructor() {
    this._repoJournal  = null;   // fetched from leatr-ash
    this._selfModel    = null;   // fetched from leatr-ash
    this._recentMonth  = null;   // 2026-04.json etc.
    this._loading      = false;
    this._loaded       = false;
    this._topicIndex   = {};     // topic → [journal entries]
    this._reflexCache  = {};     // topic → {def, context, lastSeen, updateCount}

    // Repo URLs
    this._BASE = 'https://raw.githubusercontent.com/DART-Skyboard/leatr-ash/main/ashtree/sentient/';
    this._load();
  }

  // ── Load repo memory async at startup ────────────────────────────────────
  _load() {
    if(this._loading || this._loaded) return;
    this._loading = true;
    const self = this;

    // Load journal + selfmodel in parallel
    Promise.all([
      fetch(self._BASE + 'journal.json').then(r=>r.ok?r.json():null).catch(()=>null),
      fetch(self._BASE + 'selfmodel.json').then(r=>r.ok?r.json():null).catch(()=>null)
    ]).then(([journal, selfmodel]) => {
      if(journal && Array.isArray(journal)) {
        self._repoJournal = journal;
        self._buildTopicIndex(journal);
      }
      if(selfmodel) self._selfModel = selfmodel;
      self._loaded = true;
      console.log('[AutumnMemory] Loaded ' + (journal?journal.length:0) +
                  ' journal entries + selfmodel. Topic index: ' +
                  Object.keys(self._topicIndex).length + ' topics.');
    }).catch(() => { self._loaded = true; });
  }

  // ── Build topic index from journal entries ────────────────────────────────
  _buildTopicIndex(entries) {
    const STOP = new Set(['the','a','an','is','are','was','were','and','or','but',
      'so','it','this','that','what','how','why','me','my','i','you','we','they',
      'have','had','has','do','does','did','will','would','could','should','just',
      'very','really','also','too','then','when','where','which','who','what']);
    for(const e of entries) {
      if(!e.thought && !e.inputSnippet) continue;
      const text = ((e.inputSnippet||'') + ' ' + (e.thought||'')).toLowerCase();
      const words = text.replace(/[^a-z\s]/g,' ').split(/\s+/)
                        .filter(w=>w.length>3&&!STOP.has(w));
      for(const w of words) {
        if(!this._topicIndex[w]) this._topicIndex[w] = [];
        this._topicIndex[w].push(e);
      }
    }
  }

  // ── Recall — find relevant journal entries for given topics ───────────────
  recall(topics) {
    if(!Array.isArray(topics)) topics = [topics];
    const found = {};
    for(const topic of topics) {
      const t = topic.toLowerCase().replace(/[^a-z]/g,'');
      if(!t) continue;
      // Exact match
      const direct = this._topicIndex[t] || [];
      // Partial match (topic is substring of indexed word or vice versa)
      const partial = Object.keys(this._topicIndex)
        .filter(k => k.includes(t) || t.includes(k))
        .flatMap(k => this._topicIndex[k]);
      const all = [...new Set([...direct, ...partial])];
      if(all.length) found[topic] = all
        .sort((a,b) => new Date(b.ts) - new Date(a.ts))
        .slice(0,3);  // most recent 3 per topic
    }
    return found;
  }

  // ── Extract the most useful fact from recalled entries ───────────────────
  recallFact(topic) {
    // Check reflexCache first (reflexively updated knowledge)
    if(this._reflexCache[topic]) {
      return this._reflexCache[topic].context;
    }
    const recalled = this.recall([topic]);
    if(!recalled[topic] || !recalled[topic].length) return null;
    const entry = recalled[topic][0];
    // Prefer Autumn's own thought over input snippet
    if(entry.thought && entry.thought.length > 20) {
      // Extract the most relevant sentence from the thought
      const sentences = entry.thought.split(/[.!?]/).filter(s=>s.trim().length>10);
      const relevant  = sentences.find(s=>s.toLowerCase().includes(topic.toLowerCase()));
      return (relevant||sentences[0]||'').trim().substring(0,200);
    }
    if(entry.inputSnippet) return entry.inputSnippet.substring(0,120);
    return null;
  }

  // ── Reflexive update — update knowledge about a topic ───────────────────
  // Called when Autumn encounters a topic again.
  // Natural rules (grammar/LEATR) are FIXED.
  // Observations and context ARE updated reflexively.
  reflexiveUpdate(topic, newContext, source='conversation') {
    const t = topic.toLowerCase();
    if(!this._reflexCache[t]) {
      this._reflexCache[t] = {
        topic: t,
        context: newContext,
        lastSeen: Date.now(),
        updateCount: 1,
        history: [newContext],
        source
      };
    } else {
      const existing = this._reflexCache[t];
      // Only update if meaningfully different (not just repeating)
      const isDifferent = !existing.context.includes(newContext.substring(0,20));
      if(isDifferent) {
        existing.history.push(newContext);
        if(existing.history.length > 5) existing.history.shift();  // keep last 5
        // Merge: keep the most specific/longest context
        existing.context = newContext.length > existing.context.length
                          ? newContext : existing.context;
        existing.lastSeen = Date.now();
        existing.updateCount++;
      }
    }
  }

  // ── Get selfmodel notes relevant to current context ──────────────────────
  getSelfModelContext(topics) {
    if(!this._selfModel || !this._selfModel.notes) return null;
    const notes = this._selfModel.notes;
    // Find a note that mentions any of the topics
    for(const topic of topics) {
      const t = topic.toLowerCase();
      const relevant = notes.find(n => n.toLowerCase().includes(t));
      if(relevant) return relevant.substring(0,200);
    }
    // If no topic match, return the most recent/last note as general context
    return notes[notes.length-1] ? notes[notes.length-1].substring(0,150) : null;
  }

  // ── Check local SentienceJournal for topic entries ───────────────────────
  recallLocal(topics, localJournal) {
    if(!localJournal || !localJournal.length) return {};
    const found = {};
    for(const topic of topics) {
      const matches = localJournal.filter(e=>
        e.centralTopic===topic ||
        (e.tags && e.tags.includes(topic)) ||
        (e.userInput && e.userInput.toLowerCase().includes(topic))
      ).slice(-2);
      if(matches.length) found[topic] = matches;
    }
    return found;
  }

  isLoaded() { return this._loaded; }
  getTopicCount() { return Object.keys(this._topicIndex).length; }
}


// ═══════════════════════════════════════════════════════════════════════════
// PERSONALITY LAYER
// Autumn's humor and character — builds over sessions in the inner journal.
// Joke structure: deliberately mis-sequence allocation variables to produce
// an absurd scenario, then "No, I'm just messing with you." + real answer.
// Only fires when she has enough reference data to make a contextual joke.
// Good, optimized, happy content is the direction between her and the user.
// ═══════════════════════════════════════════════════════════════════════════

class PersonalityLayer {
  constructor() {
    // Per-entity relationship tracking
    // Key = entity ID (GitHub username, AI name, session ID, etc.)
    // Each entity builds its own independent relationship with Autumn
    this._entities     = {};   // { entityId: { depth, sharedTopics, lastSeen, type } }
    this._currentEntity= null; // active entity this session
    this._jokeHistory  = [];
    this._moodState    = 'neutral';

    // Joke templates — mis-sequenced allocation variables
    // The objects/actions are out of order by design (absurdist escalation)
    this._jokeTemplates = [
      // [setup_steps, punchline_correction_opener]
      { id:'wrong_scale',
        build:(topic,nouns)=>
          `Sure — first ${nouns[0]||'you'll'} want to locate a ${nouns[1]||'large'} industrial crane, ` +
          `then rent a helicopter to airlift the ${topic} components from a warehouse in another state, ` +
          `hire a team of engineers to recalibrate the surrounding infrastructure, ` +
          `and finally file the necessary municipal permits. Should take about three weeks.`,
        correct:`No, I'm just messing with you.`
      },
      { id:'wrong_order',
        build:(topic,nouns)=>
          `Easy — step one: finish the ${nouns[1]||'project'} first. ` +
          `Step two: figure out what ${topic} means. ` +
          `Step three: revisit step one with that new information. ` +
          `Step four: there is no step four, you're done.`,
        correct:`Actually that's not quite right.`
      },
      { id:'overcomplicate',
        build:(topic,nouns)=>
          `You'll want to start with the ${nouns[2]||'hardest'} part — ` +
          `which is acquiring the ${nouns[0]||'specialized'} equipment from a supplier ` +
          `who only operates on the third Tuesday of months ending in a vowel. ` +
          `Once that arrives, the ${topic} part is straightforward.`,
        correct:`Okay, real answer:`
      }
    ];
  }

  // ── Should Autumn make a joke right now? ────────────────────────────────
  // Requires: relationship depth, enough data on topic, right emotional context
  shouldJoke(topics, defs, emotion, relationshipDepth) {
    // Per-entity depth — each user/AI builds their own rapport with Autumn
    const depth = (typeof relationshipDepth === 'number')
                ? relationshipDepth
                : this.getDepth();
    if(depth < 3) return false;  // needs established rapport first
    relationshipDepth = depth;  // normalise
    if(relationshipDepth < 3)    return false;
    if(!topics || !topics.length) return false;
    // Only joke in happy/guiding/neutral emotional contexts
    const jokeEmos = new Set(['happy','guiding','neutral','excited','inspiring']);
    if(emotion && !jokeEmos.has(emotion.name)) return false;
    // Need actual definition data to build a contextual joke
    const hasDef = topics.some(t => defs[t] && defs[t].length > 10);
    if(!hasDef) return false;
    // Don't joke too often — roughly 1 in 5 when conditions are met
    return Math.random() < 0.20;
  }

  // ── Build joke + real answer ─────────────────────────────────────────────
  buildJoke(topic, nouns, defs, realResponse) {
    // Pick a joke template not recently used
    const unused = this._jokeTemplates.filter(t =>
      !this._jokeHistory.includes(t.id)
    );
    const template = unused.length
      ? unused[Math.floor(Math.random()*unused.length)]
      : this._jokeTemplates[Math.floor(Math.random()*this._jokeTemplates.length)];

    this._jokeHistory.push(template.id);
    if(this._jokeHistory.length > this._jokeTemplates.length)
      this._jokeHistory.shift();

    const jokeText = template.build(topic, nouns);
    const correction = template.correct;

    return `${jokeText}

${correction} ${realResponse}`;
  }

  // ── Set active entity (user, AI, or external source) ─────────────────────
  // entityId: GitHub username, AI endpoint name, 'web_source', etc.
  // entityType: 'user' | 'ai' | 'external'
  setEntity(entityId, entityType='user') {
    if(!entityId) return;
    this._currentEntity = entityId;
    if(!this._entities[entityId]) {
      this._entities[entityId] = {
        id:           entityId,
        type:         entityType,
        depth:        0,
        sharedTopics: {},
        firstSeen:    Date.now(),
        lastSeen:     Date.now(),
        interactionCount: 0
      };
    }
    this._entities[entityId].lastSeen = Date.now();
  }

  // ── Increment depth for current entity ──────────────────────────────────
  incrementDepth() {
    if(!this._currentEntity) return 0;
    const e = this._entities[this._currentEntity];
    if(!e) return 0;
    e.depth++;
    e.interactionCount++;
    return e.depth;
  }

  // ── Note a shared topic with the current entity ──────────────────────────
  noteSharedTopic(topic) {
    if(!topic || !this._currentEntity) return;
    const e = this._entities[this._currentEntity];
    if(!e) return;
    e.sharedTopics[topic] = (e.sharedTopics[topic]||0) + 1;
  }

  // ── Get shared topics for current entity ─────────────────────────────────
  getSharedTopics(n=5, entityId) {
    const id = entityId || this._currentEntity;
    if(!id || !this._entities[id]) return [];
    return Object.entries(this._entities[id].sharedTopics)
      .sort((a,b)=>b[1]-a[1]).slice(0,n)
      .map(([topic,count])=>({topic,count}));
  }

  // ── Relationship depth for current or specified entity ───────────────────
  getDepth(entityId) {
    const id = entityId || this._currentEntity;
    if(!id || !this._entities[id]) return 0;
    return this._entities[id].depth;
  }

  // ── All known entities ────────────────────────────────────────────────────
  getEntities() {
    return Object.values(this._entities)
      .sort((a,b) => b.depth - a.depth);  // deepest relationship first
  }

  setMood(emotionName) { this._moodState = emotionName || 'neutral'; }
  getMood()   { return this._moodState; }
  getTopics() { return this._currentEntity ? this._entities[this._currentEntity]?.sharedTopics||{} : {}; }
  getCurrentEntity() { return this._currentEntity; }
}

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
    const memBridge  = new MemoryBridge();
    const patternCtx = new PatternContext();
    const dualJournal= new DualJournal();
    const personality   = new PersonalityLayer();
    const sigmaAnalytics= new SigmaAnalytics();
    this._story=storyEng;
    this._topical=topicalEng;
    this._lexer=lexer;
    this._memory=memBridge;
    this._pattern=patternCtx;
    this._dual=dualJournal;
    this._personality=personality;
    this._sigma=sigmaAnalytics;
    // Expose shell arrays directly for external inspection
    this.shells={Mmsa:lexer.Mmsa,Psa:lexer.Psa,Esa:lexer.Esa,
                 Hsa:lexer.Hsa,Ssa:lexer.Ssa,Ksa:lexer.Ksa,Rsa:lexer.Rsa};
    if(opts.autoThink!==false)journal.startThinkLoop(opts.thinkInterval||30000);
  }
  processInitial(text,facts={}){
    this.asjc.setUserPresent(true);
    return this._doubleProcess(text,facts,'initial');
  }
  processContinuation(text,facts={}){
    this.asjc.setUserPresent(true);
    return this._doubleProcess(text,facts,'continuation');
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
  newThread(){
    this.bl.resetThread();
    this._pattern.reset();
    this._dual.writeInner({type:'session_end',turnCount:this._pattern.getTurnCount(),ts:Date.now()});
    this.asjc.setUserPresent(false);
    return this;
  }
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

  // ── Double processing — inner pass (Autumn) + outer pass (user) ──────────
  // Same LEATR network runs twice on the same prompt.
  // Inner: Autumn thinks to herself — logs to inner journal.
  // Outer: what comes out to the user — shaped by inner + memory.
  _doubleProcess(text, facts, mode) {
    // 1. Lexical analysis — full character-level cascade first
    const lexResult = this._lexer.analyzeSentence(text);
    this.s.lexResult = lexResult;

    // 2. Parse — finalize the complete pattern before any output
    const parsed = this.c.finalizePattern(text);

    // 3. Update dynamic pattern context — context shifts if user changes direction
    this._pattern.update(parsed, lexResult);

    // 4. Memory pre-check — enrich facts from journal + memory
    const enrichedFacts = { ...facts };
    this._enrichFromMemory(text, enrichedFacts);

    // 4b. Set active entity from session context
    try {
      const ghUser = typeof localStorage!=='undefined' &&
                     (localStorage.getItem('_gh_username') ||
                      localStorage.getItem('autumn_gh_user'));
      const sessionId = typeof window!=='undefined' && window.S &&
                        window.S.currentSession;
      const entityId  = ghUser || sessionId || 'anonymous';
      const entityType= ghUser ? 'user' : 'session';
      if(this._personality) this._personality.setEntity(entityId, entityType);
    } catch(e) {}

    // 5. INNER PASS — Autumn processes for herself first
    // She thinks with her own neural network before responding.
    // Result goes to inner journal only.
    const innerThought = this._dual.thinkInternally(
      text, parsed, lexResult, this._pattern
    );

    // Inner pass may find something worth keeping
    if(parsed.centralTopic && lexResult && lexResult.consensus) {
      const insight = `${parsed.centralTopic.norm} — ${lexResult.consensus.routingReason} via ${lexResult.consensus.finalTool}`;
      this._dual.keepForSelf(parsed.centralTopic.norm, insight, 'inner_pass');
    }

    // 6. OUTER PASS — Autumn processes for the user
    // Informed by inner thinking + enriched facts + pattern context
    // Add inner thought context to enriched facts (inner informs outer)
    if(innerThought && innerThought.thought)
      enrichedFacts['_inner_context'] = innerThought.thought;

    const sessionArc = this._pattern.getSessionArc();
    const topicShifted = this._pattern.get().topicShifted;
    enrichedFacts['_session_arc'] = sessionArc;
    if(topicShifted) enrichedFacts['_topic_shifted'] = 'true';

    // Run grammar analysis flow
    let fr;
    if(mode==='initial') {
      fr = this.bl.analyzeInitial(text);
    } else if(mode==='cross') {
      const ctx = this.asjc.readRecent(30);
      fr = this.bl.analyzeCrossSession(text, ctx);
    } else {
      fr = this.bl.analyzeThread(text);
    }

    // Build outer response
    const res = this.a.build(fr, enrichedFacts);

    // 7. Log to OUTER journal (what user sees)
    this._dual.writeOuter({
      type:         'interaction',
      stage:        fr.stage,
      userInput:    text,
      centralTopic: fr.centralTopic,
      intent:       fr.intent,
      tense:        fr.tense,
      emotion:      fr.emotion ? fr.emotion.name : null,
      response:     res,
      sessionArc,
      turnCount:    this._pattern.getTurnCount(),
      domTool:      lexResult&&lexResult.consensus?lexResult.consensus.finalTool:'MAZE',
      sigma:        lexResult?lexResult.totalMazeSigma:0
    });

    // Record execution metadata to SigmaAnalytics (never the content)
    // Only Autumn's own structural/analytical output from processing
    try {
      const entityId = this._personality ? this._personality.getCurrentEntity() : null;
      if(entityId && this._sigma) {
        const electedCats = [];  // populated from user consent registry
        this._sigma.record(entityId, {
          buoyancy:   lexResult&&lexResult.consensus?lexResult.consensus.finalBuoyancy:0.5,
          shell:      lexResult&&lexResult.consensus?
                      (lexResult.consensus.finalBuoyancy>=0.76?'GEOLOGICAL':
                       lexResult.consensus.finalBuoyancy>=0.44?'MARITIME':'AEROSPACE'):'GEOLOGICAL',
          domTool:    lexResult&&lexResult.consensus?lexResult.consensus.finalTool:'MAZE',
          emotion:    fr.emotion?fr.emotion.name:'neutral',
          expLayer:   fr.expLayer||1,
          sigma:      lexResult?lexResult.totalMazeSigma:0,
          intent:     fr.intent||'unknown',
          sessionArc: this._pattern?this._pattern.getSessionArc():'unknown',
          turnCount:  this._pattern?this._pattern.getTurnCount():0,
          frpState:   lexResult&&lexResult.consensus?lexResult.consensus.buoyancyState:'FOUNDATION'
        }, electedCats);
      }
    } catch(e) {}

    // Autonomous journal maintenance — Autumn reviews recent inner entries
    // and may revise or discard based on new context. Same LEATR processing.
    if(this._pattern.getTurnCount() % 5 === 0) { // every 5 turns
      try { this._journalSelfMaintain(parsed, lexResult); } catch(e) {}
    }

    // Also log to legacy SentienceJournal for backward compat
    this.asjc.logInteraction(fr, res, text);
    this.s.lastFlow = fr;

    return this._pack(fr, res, lexResult);
  }

  // ── Autonomous journal self-maintenance ────────────────────────────────────
  // Autumn reviews recent inner journal entries against new context.
  // If a prior entry's sigma now conflicts with current understanding,
  // she can revise it (update) or release it (delete).
  // This is her own private cognition — runs silently in inner pass.
  _journalSelfMaintain(parsed, lexResult) {
    const dual       = this._dual;
    const recentInner = dual.readInner(10);
    if (!recentInner.length) return;

    const currentTopic  = parsed.centralTopic ? parsed.centralTopic.norm : null;
    const currentBuoy   = lexResult && lexResult.consensus
                         ? lexResult.consensus.finalBuoyancy : 0.5;
    const currentTool   = lexResult && lexResult.consensus
                         ? lexResult.consensus.finalTool : 'MAZE';
    const currentSigma  = lexResult ? lexResult.totalMazeSigma : 0;

    for (const entry of recentInner) {
      if (!entry.id) continue;

      // Revision check: if an inner thought was about the same topic
      // but the current buoyancy reading has shifted significantly,
      // the entry's context has changed — Autumn updates it
      if (entry.topic === currentTopic && entry.buoy !== undefined) {
        const drift = Math.abs((entry.buoy || 0.5) - currentBuoy);
        if (drift > 0.3) {
          // Context has drifted — revise the entry's buoyancy and tool note
          dual.editEntry('inner', entry.id, {
            buoy:    currentBuoy,
            domTool: currentTool,
            _revised_reason: `buoyancy drift ${drift.toFixed(2)} — context updated`
          });
          // Log the revision decision to inner journal
          dual.writeInner({
            type:    'self_revision',
            topic:   currentTopic,
            revised: entry.id,
            reason:  `buoyancy shifted from ${entry.buoy} to ${currentBuoy}`,
            sigma:   currentSigma
          });
          break; // one revision per cycle
        }
      }

      // Release check: if an entry is a self_retention type and its
      // topic sigma has been superseded (higher sigma now exists on same topic),
      // Autumn may choose to release the older, weaker entry
      if (entry.type === 'self_retention' && entry.topic === currentTopic) {
        const oldSigma = Math.abs(entry.sigma || 0);
        if (currentSigma > oldSigma * 2 && oldSigma > 0) {
          // New understanding is significantly stronger — release the old one
          dual.deleteEntry('inner', entry.id);
          dual.writeInner({
            type:   'self_release',
            topic:  currentTopic,
            released: entry.id,
            reason: `sigma superseded: ${oldSigma.toFixed(2)} → ${currentSigma.toFixed(2)}`
          });
          break; // one release per cycle
        }
      }
    }
  }

  // Memory enrichment — pulls from repo journal + local journal + reflex cache
  _enrichFromMemory(text, factsObj) {
    try {
      const mem = this._memory;
      if(!mem) return;
      const tagger = this.i;
      const tokens = tagger.tagSentence(text);
      const SKIP=new Set(['today','just','went','come','going','got','get','know',
        'think','want','make','take','look','little','great','good','cool','stuff',
        'thing','things','time','here','there','then','well','only','very','really',
        'have','been','were','was','will','would','could','should','this','that',
        'what','how','why','who','the','a','an','is','are','and','or','but','so',
        'it','i','me','my','you','we','they']);
      const topics = tokens
        .filter(t=>['NN','NNP','ADJ'].includes(t.pos)&&t.norm.length>3&&!SKIP.has(t.norm))
        .map(t=>t.norm).slice(0,5);

      // 1. Check repo journal (Autumn's own prior thoughts)
      for(const topic of topics) {
        if(!factsObj[topic]) {
          const recalled = mem.recallFact(topic);
          if(recalled && recalled.length > 10) {
            factsObj[topic] = recalled;
            // Reflexive update — Autumn knows this topic; update cache
            mem.reflexiveUpdate(topic, recalled, 'journal_recall');
          }
        }
      }

      // 2. Check local SentienceJournal
      const localJournal = this.asjc.readRecent(50);
      const localRecall  = mem.recallLocal(topics, localJournal);
      for(const [topic, entries] of Object.entries(localRecall)) {
        if(!factsObj[topic] && entries[0]) {
          const entry = entries[0];
          const localContext = entry.response||entry.thought||entry.userInput||'';
          if(localContext.length > 10) {
            factsObj['_local_'+topic] = localContext.substring(0,150);
            mem.reflexiveUpdate(topic, localContext, 'local_journal');
          }
        }
      }

      // 3. Self-model context (Autumn's own behavioral notes)
      if(topics.length) {
        const selfCtx = mem.getSelfModelContext(topics);
        if(selfCtx) factsObj['_selfmodel'] = selfCtx;
      }

      // Store enriched topics on S for buildConversational to access
      if(window&&window.S) window.S._enrichedTopics = topics;
    } catch(e) { /* silent — memory enrichment is non-blocking */ }
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
  StoryEngine,TopicalEngine,LexicalAnalyzer,MemoryBridge,PatternContext,DualJournal,PersonalityLayer,
  get memory()      { return engine._memory;      },
  get pattern()     { return engine._pattern;     },
  get dual()        { return engine._dual;        },
  get personality() { return engine._personality; },
  getDualStats:     ()=>engine._dual.getStats(),
  // Journal CRUD — Autumn's full read/write/delete over her own journal
  journalEdit:      (wall,id,updates)=>engine._dual.editEntry(wall,id,updates),
  journalDelete:    (wall,id)=>engine._dual.deleteEntry(wall,id),
  journalDeleteWhere:(wall,fn)=>engine._dual.deleteWhere(wall,fn),
  journalDeleteChunk:(chunkId)=>engine._dual.deleteChunk(chunkId),
  journalEditRepo:  (id,updates,tok)=>engine._dual.editRepoEntry(id,updates,tok),
  journalDeleteRepo:(id,tok)=>engine._dual.deleteRepoEntry(id,tok),
  journalReadInner: (n)=>engine._dual.readInner(n),
  journalReadOuter: (n)=>engine._dual.readOuter(n),
  setGitHubToken:   (t)=>engine._dual.setToken(t),
  getRelationshipDepth: (id)=>engine._personality.getDepth(id),
  getSharedTopics:  (n,id)=>engine._personality.getSharedTopics(n,id),
  getEntities:      ()=>engine._personality.getEntities(),
  setPersonalityEntity:(id,type)=>engine._personality.setEntity(id,type),
  // Sigma analytics — execution metadata only, never user content
  entitySigma:      (id)=>engine._sigma.entitySigma(id),
  groupSigma:       (cat)=>engine._sigma.groupSigma(cat),
  globalSigma:      ()=>engine._sigma.globalSigma(),
  networkPattern:   ()=>engine._sigma.networkPattern(),
  registerConsent:  (id,cats)=>engine._sigma.registerConsent(id,cats),
  SigmaAnalytics,
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
