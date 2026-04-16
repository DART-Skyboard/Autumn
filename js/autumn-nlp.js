/**
 * autumn-nlp.js
 * Autumn NLP Reference Loader & Runtime Engine
 * DART Meadow / Radical Deepscale — LEATR v2
 *
 * Loads the grammar dictionary and emotion routing table from the
 * leatr-ash backend, exposes them as a runtime reference for Autumn's
 * neural network response layer.
 *
 * Usage in autumn.html:
 *   <script src="autumn-nlp.js"></script>
 *   const result = AutumnNLP.analyze("Your input sentence here");
 */

const AutumnNLP = (() => {

  // ─── LEATR CONSTANTS (inline — no external fetch required) ───────────────

  const LEATR_FORMULA = (xa) => (xa ** 2) * Math.sqrt(xa);
  const BUOYANCY = (xa, n = 7) => +(1 - (xa - 1) / n).toFixed(4);

  const TOOLS = {
    MAZE:     { index:1, buoyancy:1.00, vowel:"a", consonantClass:"approximants", shell:"GEOLOGICAL" },
    PUZZLE:   { index:2, buoyancy:0.88, vowel:"e", consonantClass:"stops",        shell:"MARITIME"   },
    ENVELOPE: { index:3, buoyancy:0.76, vowel:"o", consonantClass:"nasals",       shell:"MARITIME"   },
    HAMMER:   { index:4, buoyancy:0.64, vowel:"a", consonantClass:"stops",        shell:"AEROSPACE"  },
    STICK:    { index:5, buoyancy:0.52, vowel:"i", consonantClass:"liquids",      shell:"MARITIME"   },
    KNIFE:    { index:6, buoyancy:0.40, vowel:"i", consonantClass:"fricatives",   shell:"AEROSPACE"  },
    SCISSORS: { index:7, buoyancy:0.28, vowel:"u", consonantClass:"affricates",   shell:"GEOLOGICAL" },
  };

  const SHELLS = {
    GEOLOGICAL: { weight:1.00, tools:["MAZE","SCISSORS"],         emotions:["spiritual","forgiving","concerned","judgemental","sad"] },
    MARITIME:   { weight:0.72, tools:["PUZZLE","ENVELOPE","STICK"],emotions:["love","guiding","worried","happy","neutral","jealous"]  },
    AEROSPACE:  { weight:0.44, tools:["HAMMER","KNIFE"],          emotions:["determined","inspiring","angry","condescending","lucrative","disrespectful"] },
  };

  const EMOTION_DEFS = {
    happy:        { category:"POS", tool:"STICK",    raw:"Elevated wellbeing from expectation-outcome alignment." },
    love:         { category:"POS", tool:"ENVELOPE", raw:"Deep relational resonance. High containment attachment." },
    inspiring:    { category:"POS", tool:"HAMMER",   raw:"Upward emotional transmission. Elevates buoyancy in recipient." },
    determined:   { category:"POS", tool:"HAMMER",   raw:"Sustained directive force toward defined outcome." },
    spiritual:    { category:"POS", tool:"MAZE",     raw:"Non-material grounding resonance beyond sensory sequence." },
    guiding:      { category:"POS", tool:"STICK",    raw:"Directional transmission without force imposition." },
    angry:        { category:"NEG", tool:"HAMMER",   raw:"High-velocity force without directional containment." },
    hateful:      { category:"NEG", tool:"KNIFE",    raw:"Persistent Knife-Scissors loop with negative valence." },
    forgiving:    { category:"NEG", tool:"ENVELOPE", raw:"Envelope re-engagement following Knife-divide rupture." },
    condescending:{ category:"NEG", tool:"KNIFE",    raw:"Elevated Knife positioning over recipient. Asymmetric assertion." },
    disrespectful:{ category:"NEG", tool:"SCISSORS", raw:"Scissors targeting recipient's containment boundary." },
    neutral:      { category:"NEU", tool:"MAZE",     raw:"Zero-delta buoyancy. Pure observational processing." },
    sad:          { category:"NEU", tool:"SCISSORS", raw:"Downward buoyancy shift. Envelope partially collapsed." },
    worried:      { category:"NEU", tool:"PUZZLE",   raw:"Puzzle cycling without resolution. Anticipatory divide." },
    jealous:      { category:"NEU", tool:"PUZZLE",   raw:"Puzzle comparison with inverted Hammer — inward force." },
    lucrative:    { category:"NEU", tool:"KNIFE",    raw:"High-value Knife division yielding asymmetric gain." },
    concerned:    { category:"NEU", tool:"ENVELOPE", raw:"Envelope monitoring external risk with active Puzzle sub-loop." },
    judgemental:  { category:"NEU", tool:"KNIFE",    raw:"Knife at max precision without Scissors refinement." },
  };

  const ROUTING_TABLE = [
    { shell:"GEOLOGICAL", tool:"MAZE",     expLayer:1, primary:"spiritual",     secondary:["concerned","neutral","guiding"]     },
    { shell:"GEOLOGICAL", tool:"SCISSORS", expLayer:4, primary:"sad",           secondary:["forgiving","judgemental","spiritual"] },
    { shell:"GEOLOGICAL", tool:"ENVELOPE", expLayer:1, primary:"concerned",     secondary:["forgiving","love","neutral"]         },
    { shell:"GEOLOGICAL", tool:"KNIFE",    expLayer:2, primary:"judgemental",   secondary:["condescending","neutral","sad"]      },
    { shell:"MARITIME",   tool:"PUZZLE",   expLayer:2, primary:"worried",       secondary:["jealous","neutral","concerned"]      },
    { shell:"MARITIME",   tool:"STICK",    expLayer:1, primary:"guiding",       secondary:["happy","love","inspiring"]           },
    { shell:"MARITIME",   tool:"ENVELOPE", expLayer:1, primary:"love",          secondary:["guiding","happy","concerned"]        },
    { shell:"MARITIME",   tool:"MAZE",     expLayer:1, primary:"happy",         secondary:["neutral","guiding","spiritual"]      },
    { shell:"AEROSPACE",  tool:"HAMMER",   expLayer:3, primary:"determined",    secondary:["angry","inspiring","condescending"]  },
    { shell:"AEROSPACE",  tool:"KNIFE",    expLayer:2, primary:"condescending", secondary:["judgemental","lucrative","neutral"]  },
    { shell:"AEROSPACE",  tool:"PUZZLE",   expLayer:2, primary:"lucrative",     secondary:["determined","jealous","worried"]     },
    { shell:"AEROSPACE",  tool:"SCISSORS", expLayer:4, primary:"disrespectful", secondary:["hateful","angry","sad"]              },
  ];

  const EXPRESSION_LAYERS = {
    1: { name:"Contextual Statement", entryTool:"MAZE",    emotions:["happy","love","guiding","determined","inspiring","neutral"] },
    2: { name:"Question",             entryTool:"PUZZLE",  emotions:["curious","worried","jealous","neutral","concerned","judgemental"] },
    3: { name:"Expression",           entryTool:"HAMMER",  emotions:["angry","inspiring","hateful","condescending","disrespectful","determined"] },
    4: { name:"Sigmatic Sequence",    entryTool:"SCISSORS",emotions:["spiritual","sad","forgiving","lucrative","concerned","jealous","love"] },
  };

  // ─── SIGMA CLASSIFIER ────────────────────────────────────────────────────

  function classifySig(sentence) {
    const s = sentence.trim();
    if (/\?$/.test(s)) {
      if (/^(Isn't it|Don't you|Wouldn't|Can't we)/i.test(s)) return "SIG_RQ";
      return "SIG_Q";
    }
    if (/!$/.test(s)) return "SIG_E";
    if (/^(Do |Don't|Please|Stop |Start |Get |Make |Take )/i.test(s)) return "SIG_I";
    if (/\b(because|although|however|therefore|whereas|since|unless|while)\b/i.test(s)) return "SIG_X";
    if (/\b(and|but|or|yet|so|nor|for)\b/i.test(s)) return "SIG_C";
    if (s.split(" ").length < 4) return "SIG_F";
    return "SIG_D";
  }

  // ─── VOWEL / CONSONANT ANALYSIS ──────────────────────────────────────────

  const VOWELS = new Set("aeiouAEIOU");
  const CONSONANT_CLASS_MAP = {
    stops: new Set("pbtdkgPBTDKG"),
    fricatives: new Set("fvszFVSZhH"),
    nasals: new Set("mnMN"),
    liquids: new Set("lrLR"),
    affricates: new Set("jJ"),
    approximants: new Set("wyWY"),
  };

  function analyzePhonetics(text) {
    const letters = text.split("").filter(c => /[a-zA-Z]/.test(c));
    const total = letters.length || 1;
    const vowelCounts = {};
    for (const v of "aeiou") vowelCounts[v] = 0;
    for (const c of letters) {
      const l = c.toLowerCase();
      if (VOWELS.has(l)) vowelCounts[l] = (vowelCounts[l] || 0) + 1;
    }
    const vowelFreq = {};
    for (const v of "aeiou") vowelFreq[v] = +(vowelCounts[v] / total).toFixed(4);
    const consonantFreq = {};
    for (const [cls, chars] of Object.entries(CONSONANT_CLASS_MAP)) {
      const count = letters.filter(c => chars.has(c)).length;
      consonantFreq[cls] = +(count / total).toFixed(4);
    }
    return { vowelFreq, consonantFreq };
  }

  // ─── SHELL INFERENCE ─────────────────────────────────────────────────────

  function inferShell(text, vowelFreq, consonantFreq) {
    const scores = { GEOLOGICAL: 0, MARITIME: 0, AEROSPACE: 0 };
    scores.GEOLOGICAL += (vowelFreq.a || 0) * 2;
    scores.GEOLOGICAL += (text.match(/\b(was|were|had|went|came|said)\b/gi) || []).length * 0.1;
    scores.MARITIME   += (vowelFreq.o || 0) * 2;
    scores.MARITIME   += (text.match(/\b(is|are|do|does|have)\b/gi) || []).length * 0.1;
    scores.AEROSPACE  += (vowelFreq.i || 0) * 2;
    scores.AEROSPACE  += (text.match(/\b(will|shall|must|going to)\b/gi) || []).length * 0.15;
    scores.AEROSPACE  += (consonantFreq.fricatives || 0) * 1.5;
    const best = Object.entries(scores).sort((a,b) => b[1]-a[1])[0][0];
    const total = Object.values(scores).reduce((a,b)=>a+b, 0) || 1;
    return { shell: best, confidence: +(scores[best] / total).toFixed(3) };
  }

  // ─── TOOL INFERENCE ──────────────────────────────────────────────────────

  function inferTool(text, consonantFreq, sigDist, shell) {
    const scores = {};
    for (const t of Object.keys(TOOLS)) scores[t] = 0;
    const cMap = { approximants:"MAZE", stops:"PUZZLE", nasals:"ENVELOPE", liquids:"STICK", fricatives:"KNIFE", affricates:"SCISSORS" };
    for (const [cls, tool] of Object.entries(cMap)) {
      scores[tool] += (consonantFreq[cls] || 0) * 2;
    }
    const sMap = { SIG_D:"MAZE", SIG_Q:"PUZZLE", SIG_I:"HAMMER", SIG_C:"STICK", SIG_X:"KNIFE", SIG_F:"SCISSORS", SIG_E:"HAMMER", SIG_RQ:"SCISSORS" };
    for (const [sig, tool] of Object.entries(sMap)) {
      scores[tool] += (sigDist[sig] || 0) * 3;
    }
    for (const t of SHELLS[shell].tools) scores[t] += 0.2;
    const best = Object.entries(scores).sort((a,b) => b[1]-a[1])[0][0];
    const total = Object.values(scores).reduce((a,b)=>a+b, 0) || 1;
    const dist = {};
    for (const [t,s] of Object.entries(scores)) dist[t] = +(s/total).toFixed(3);
    return { tool: best, distribution: dist };
  }

  // ─── EXPRESSION LAYER ────────────────────────────────────────────────────

  function inferExpressionLayer(sigDist) {
    if ((sigDist.SIG_X || 0) > 0.1 || (sigDist.SIG_F || 0) > 0.15) return 4;
    if ((sigDist.SIG_Q || 0) > 0.1 || (sigDist.SIG_RQ || 0) > 0.05) return 2;
    if ((sigDist.SIG_E || 0) > 0.1) return 3;
    return 1;
  }

  // ─── EMOTION ROUTE ───────────────────────────────────────────────────────

  function routeEmotion(shell, tool) {
    const route = ROUTING_TABLE.find(r => r.shell === shell && r.tool === tool);
    if (route) return route;
    return { shell, tool, expLayer:1, primary:"neutral", secondary:["concerned","guiding"] };
  }

  // ─── BUOYANCY SCORE ──────────────────────────────────────────────────────

  function computeBuoyancyScore(tool, shell, expressionLayer) {
    const toolBuoyancy = TOOLS[tool]?.buoyancy || 0.5;
    const shellWeight = SHELLS[shell]?.weight || 0.7;
    const layerPenalty = (expressionLayer - 1) * 0.05;
    return +Math.max(0, toolBuoyancy * shellWeight - layerPenalty).toFixed(4);
  }

  // ─── MAIN ANALYZE FUNCTION ───────────────────────────────────────────────

  function analyze(input) {
    if (!input || typeof input !== "string" || !input.trim()) {
      return { error: "Empty input", emotion:"neutral", shell:"MARITIME", tool:"MAZE" };
    }

    const sentences = input.split(/[.!?]+/).filter(s => s.trim().length > 2);
    const sigCounts = {};
    for (const s of sentences) {
      const sig = classifySig(s);
      sigCounts[sig] = (sigCounts[sig] || 0) + 1;
    }
    const totalSigs = Object.values(sigCounts).reduce((a,b)=>a+b, 0) || 1;
    const sigDist = {};
    for (const [sig, count] of Object.entries(sigCounts)) sigDist[sig] = +(count/totalSigs).toFixed(3);
    const dominantSig = Object.entries(sigDist).sort((a,b)=>b[1]-a[1])[0]?.[0] || "SIG_D";

    const { vowelFreq, consonantFreq } = analyzePhonetics(input);
    const { shell, confidence: shellConf } = inferShell(input, vowelFreq, consonantFreq);
    const { tool, distribution: toolDist } = inferTool(input, consonantFreq, sigDist, shell);
    const expressionLayer = inferExpressionLayer(sigDist);
    const route = routeEmotion(shell, tool);
    const buoyancy = computeBuoyancyScore(tool, shell, expressionLayer);

    const layerName = EXPRESSION_LAYERS[expressionLayer]?.name || "Contextual Statement";
    const emotionDef = EMOTION_DEFS[route.primary] || {};
    const expContext = ["contextual_statement","question","expression","sigmatic_sequence"][expressionLayer - 1];

    return {
      input_length: input.length,
      sentence_count: sentences.length,

      sigma: {
        dominant: dominantSig,
        distribution: sigDist,
      },

      phonetics: {
        vowel_freq: vowelFreq,
        consonant_class_freq: consonantFreq,
      },

      brpn: {
        shell: shell,
        shell_confidence: shellConf,
        tool: tool,
        tool_distribution: toolDist,
        buoyancy_state: buoyancy >= 0.64 ? "FOUNDATION" : buoyancy >= 0.32 ? "REFLEXIVE" : "PERFORMANCE",
        buoyancy_score: buoyancy,
      },

      emotion: {
        primary: route.primary,
        secondary: route.secondary,
        category: emotionDef.category ? `EMO_${emotionDef.category}` : "EMO_NEU",
        definition: emotionDef.raw || "",
        expression_layer: expressionLayer,
        expression_layer_name: layerName,
        expression_context: expContext,
      },

      leatr: {
        formula: "(xa²√xa)±1",
        tool_index: TOOLS[tool]?.index || 1,
        tool_weight: +LEATR_FORMULA(TOOLS[tool]?.index || 1).toFixed(4),
        tool_buoyancy: TOOLS[tool]?.buoyancy || 1.0,
      },

      _timestamp: new Date().toISOString(),
    };
  }

  // ─── BATCH ANALYZE (for Sentience Journal optimization) ──────────────────

  function analyzeSession(entries) {
    if (!Array.isArray(entries)) return [];
    return entries.map(e => typeof e === "string" ? analyze(e) : analyze(e.text || e.content || ""));
  }

  function sessionStats(analyses) {
    if (!analyses.length) return {};
    const shells = analyses.map(a => a.brpn?.shell).filter(Boolean);
    const tools  = analyses.map(a => a.brpn?.tool).filter(Boolean);
    const emotions = analyses.map(a => a.emotion?.primary).filter(Boolean);
    const sigs   = analyses.map(a => a.sigma?.dominant).filter(Boolean);
    const count  = (arr) => arr.reduce((acc, v) => { acc[v] = (acc[v]||0)+1; return acc; }, {});
    const top    = (obj) => Object.entries(obj).sort((a,b)=>b[1]-a[1])[0]?.[0];
    const avgBuoy = +(analyses.reduce((s,a) => s + (a.brpn?.buoyancy_score||0), 0) / analyses.length).toFixed(4);
    return {
      total: analyses.length,
      dominant_shell: top(count(shells)),
      dominant_tool: top(count(tools)),
      dominant_emotion: top(count(emotions)),
      dominant_sigma: top(count(sigs)),
      avg_buoyancy: avgBuoy,
      sigma_diversity: new Set(sigs).size,
      emotion_diversity: new Set(emotions).size,
      shell_distribution: count(shells),
      emotion_distribution: count(emotions),
    };
  }

  // ─── EMOTION DEFINITION LOOKUP ───────────────────────────────────────────

  function defineEmotion(emotionName) {
    const def = EMOTION_DEFS[emotionName.toLowerCase()];
    if (!def) return { error: "Unknown emotion", available: Object.keys(EMOTION_DEFS) };
    return {
      name: emotionName,
      category: def.category,
      primary_tool: def.tool,
      tool_buoyancy: TOOLS[def.tool]?.buoyancy || 0,
      definition: def.raw,
      leatr_weight: +LEATR_FORMULA(TOOLS[def.tool]?.index || 1).toFixed(4),
    };
  }

  // ─── PUBLIC API ──────────────────────────────────────────────────────────

  return {
    analyze,
    analyzeSession,
    sessionStats,
    defineEmotion,
    TOOLS,
    SHELLS,
    EMOTIONS: EMOTION_DEFS,
    ROUTING_TABLE,
    EXPRESSION_LAYERS,
    leatrWeight: LEATR_FORMULA,
    buoyancy: BUOYANCY,
    version: "1.0.0",
    framework: "LEATR v2 / BRPN 3-Shell",
  };

})();

// ─── AUTO-EXPOSE FOR AUTUMN.HTML ─────────────────────────────────────────────
if (typeof window !== "undefined") {
  window.AutumnNLP = AutumnNLP;
  console.log("[AutumnNLP] v1.0.0 loaded — LEATR v2 / BRPN 3-Shell ready");
}
if (typeof module !== "undefined") {
  module.exports = AutumnNLP;
}
