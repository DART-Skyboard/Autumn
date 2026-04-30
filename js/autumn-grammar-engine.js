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
    const vs   =parsedInput.centralTopic?parsedInput.centralTopic.vowelScore:0;
    const tokR =Math.min((parsedInput.tokens.length||1)/20,1);
    const iConf=parsedInput.intent&&parsedInput.intent!=='default'?0.8:0.4;
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

    // Extract content words — filter out trivial tokens
    const SKIP=new Set(['is','are','was','were','be','been','a','an','the','to','of','and','or','but','so','it','this','that','what','how','why','me','my','i']);
    const nouns=subTopics[0].tokens.map(t=>t.word).filter(w=>w.length>2&&!SKIP.has(w.toLowerCase()));
    const verbs=subTopics[1].tokens.map(t=>t.word).filter(w=>!SKIP.has(w.toLowerCase())&&w.length>2);
    const mods =subTopics[2].tokens.map(t=>t.word).filter(w=>w.length>2&&!SKIP.has(w.toLowerCase()));

    const topic  = centralTopic&&centralTopic.length>2&&!SKIP.has(centralTopic)?centralTopic:nouns[0]||'this topic';

    // ── WordNet real definition lookup ─────────────────────────────
    const WN=typeof window!=='undefined'&&window.AutumnWordNet;
    const wnDef=WN?WN.defineSync(topic):null;
    // Trigger async load for next call if not in cache yet
    if(WN&&!wnDef&&topic&&topic!=='this topic') this._wnPrime(topic);
    // Also prime any content nouns for richer downstream responses
    if(WN) nouns.slice(0,2).forEach(n=>WN.lookup(n).catch(()=>{}));

    const detail = wnDef||knownFacts[topic]||[...mods,...nouns.slice(1)].join(' ')||'its essential nature';
    const verb   = verbs[0]||(tense==='past'?'showed':'involves');

    // Dominant Natural Tool from pipeline (drives opening phrase)
    let domTool='maze';
    if(pipelineResult&&pipelineResult.panels){
      const p=pipelineResult.panels.filter(r=>r.allocated);
      if(p.length) domTool=p[p.length-1].panel.toLowerCase();
    }

    const G=this._grammar;
    let opening='', body='', transition='';

    // ── Opening: tool-specific phrase from conversationFramework ──
    if(G&&G.conversationFramework&&G.conversationFramework.opening_by_tool){
      const tmpl=G.conversationFramework.opening_by_tool[domTool]||'';
      opening=tmpl
        .replace('{topic}',topic).replace('{aspect}',detail)
        .replace('{core}',detail).replace('{related_area}',detail)
        .replace('{detail}',detail).replace('{observation}',`${topic} ${verb} ${detail}`)
        .replace('{related}',nouns[1]||detail);
    }

    // ── Body: intent-mapped response template ──
    if(G&&G.responseTemplates){
      const typeMap={
        question_what:'explanatory',question_how:'analytical',question_why:'analytical',
        question_when:'declarative', question_where:'declarative',question_who:'declarative',
        question_yn:'explanatory',  statement_pos:'declarative',statement_neg:'elaborative',
        exclamation:'conversational',command_do:'conversational',command_tell:'explanatory'
      };
      const pool=G.responseTemplates[typeMap[intent]]||G.responseTemplates.declarative||[];
      if(pool.length){
        const idx=(topic.length*(nouns.length+1))%pool.length;
        const cat=this._category(topic,nouns,intent);
        body=pool[idx]
          .replace('{topic}',topic).replace('{description}',detail)
          .replace('{definition}',knownFacts[topic]||detail)
          .replace('{noun}',nouns[0]||topic).replace('{verb}',verb)
          .replace('{object}',nouns[1]||detail).replace('{subject}',nouns[0]||topic)
          .replace('{reason}',mods[0]||'its inherent structure')
          .replace('{condition}',`${topic} is active`)
          .replace('{category}',cat).replace('{detail}',detail)
          .replace('{explanation}',knownFacts[topic]||detail)
          .replace('{core_idea}',detail).replace('{process}',verb)
          .replace('{result}',`${topic} resolves`)
          .replace('{list}',[...nouns.slice(0,3),...mods.slice(0,2)].filter(Boolean).join(', ')||detail)
          .replace('{observation}',`${topic} ${verb} ${detail}`)
          .replace('{aspect}',mods[0]||nouns[1]||'its structure')
          .replace('{insight}',knownFacts[topic]||detail)
          .replace('{related}',nouns[1]||`context of ${topic}`)
          .replace('{link}',mods[0]||'shared structure')
          .replace('{perspective1}',`${topic} ${verb}`)
          .replace('{perspective2}',`${detail} extends this`)
          .replace('{clarification}',knownFacts[topic]||detail)
          .replace('{nuance}',`${topic} ${mods[0]||'operates'} beyond surface reading`)
          .replace('{core}',detail);
      }
    }

    // Fallback if grammar not loaded yet
    if(!body){
      const neg=negated?'does not ':'is ';
      body=`${topic} ${neg}${verb} ${detail}.`.replace(/\s{2,}/g,' ');
    }

    // ── Transition between opening and body ──
    if(opening&&body){
      if(G&&G.conversationFramework&&G.conversationFramework.transition_phrases){
        const elaboration=G.conversationFramework.transition_phrases.elaboration||[];
        transition=' '+(elaboration[Math.floor(Date.now()/10000)%elaboration.length]||'')+' ';
      } else {
        transition=' ';
      }
    }

    const full=(opening+transition+body).replace(/\s{2,}/g,' ').replace(/\s([.,!?])/g,'$1').trim();

    // Emotion-aware prefix
    const pre=this._pre(emotion);
    return (pre?pre+' ':'')+full;
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
class ANLPCA {
  constructor(opts={}){
    const tagger=new POSTagger();
    const parser=new SentenceParser(tagger);
    const pipeline=new SevenPanelPipeline();
    const ec=new EmotionClassifier();
    const flow=new GrammarAnalysisFlow(parser,pipeline,ec);
    const builder=new ResponseBuilder();
    const journal=new SentienceJournal(opts.journalKey);
    // LEATR variable names
    this.anlpca=this;this.cpa=tagger;this.c=parser;this.i=tagger;
    this.bl=flow;this.t=pipeline;this.a=builder;this.asjc=journal;this.s={};
    if(opts.autoThink!==false)journal.startThinkLoop(opts.thinkInterval||30000);
  }
  processInitial(text,facts={}){
    this.asjc.setUserPresent(true);
    const fr=this.bl.analyzeInitial(text);const res=this.a.build(fr,facts);
    this.asjc.logInteraction(fr,res,text);this.s.lastFlow=fr;return this._pack(fr,res);
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
  _pack(fr,response){
    return{stage:fr.stage,label:fr.label,centralTopic:fr.centralTopic,intent:fr.intent,
           tense:fr.tense,negated:fr.negated,subTopics:fr.subTopics,emotion:fr.emotion,
           expLayer:fr.expLayer,expLayerName:fr.expLayerName,allAllocated:fr.allAllocated,
           pipelineTrace:fr.pipelineResult,leatrScore:fr.leatrScore,response,
           topicEvolved:fr.topicEvolved||false,priorTopicRef:fr.priorTopicRef||null,
           dominantPast:fr.dominantPastTopic||null,timestamp:fr.timestamp};
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
  validateWord:(w)=>engine.validateWord(w),
  newThread:()=>engine.newThread(),
  userDisconnected:()=>engine.userDisconnected(),
  getJournal:()=>engine.getJournal(),
  getStats:()=>engine.getStats(),
  journalWrite:(e)=>engine.journalWrite(e),
  onJournalWrite:(fn)=>engine.asjc.onWrite(fn),
  _engine:engine,
  EMOTION_MAP,EXP_LAYERS,TOOL_DEFS,GR,leatrEncode,leatrDecode,frpSqrtFrp
};

})();

if(typeof window!=='undefined'){
  window.AutumnGrammarEngine=AutumnGrammarEngine;
  if(window.AutumnNLP)window.AutumnNLP._grammarEngine=AutumnGrammarEngine;
  console.log('%c[Autumn Grammar Engine v2.0]%c ANLPCA online. 7-Panel LEATR Pipeline active. SentienceJournal R/W running.\n  Maze→Puzzle→Envelope→Hammer→Stick→Knife→Scissors | frp√frp gate | 21 emotions | 4 expression layers',
    'color:#00e5ff;font-weight:bold','color:#aaa');
}
