// conceptnet_loader.js — Lazy ConceptNet 5.7 bucket loader for Autumn
// Mirrors the WordNet loader pattern. Buckets stored as gzipped JSON in leatr-ash.
// License: ConceptNet CC BY-SA 4.0 (https://conceptnet.io/citing-conceptnet)

const CN_REPO = 'DART-Skyboard/leatr-ash';
const CN_PATH = 'conceptnet';
const CN_BUCKETS = {
  // Lazy-loaded on first query — stays in memory for session
  language_a_h: null,  // synonyms, antonyms, related — words A-H
  language_i_r: null,  // synonyms, antonyms, related — words I-R
  language_s_z: null,  // synonyms, antonyms, related — words S-Z
  everyday:     null,  // UsedFor, CapableOf, HasA, AtLocation, IsA
  causes:       null,  // Causes, HasPrerequisite, HasSubevent
  abstract:     null,  // SymbolOf, DefinedAs, SimilarTo
  people:       null,  // desires, ReceivesAction
  social:       null,  // HasContext, related
};

// Which bucket contains a word (by first letter)
function _cnLangBucket(word) {
  const c = (word||'a')[0].toLowerCase();
  if (c <= 'h') return 'language_a_h';
  if (c <= 'r') return 'language_i_r';
  return 'language_s_z';
}

// Load a bucket (gzipped JSON) from leatr-ash via GitHub raw
async function _cnLoadBucket(bucketName, token) {
  if (CN_BUCKETS[bucketName]) return CN_BUCKETS[bucketName];
  try {
    // Public/local only — never attach a GitHub PAT to leatr-ash fetches.
    const fname = `cn_${bucketName}.json.gz`;
    const localCandidates = ['conceptnet/'+fname, 'nlp/conceptnet/'+fname, 'assets/conceptnet/'+fname];
    let res = null;
    for (const loc of localCandidates) {
      try { res = await fetch(loc); if (res && res.ok) break; } catch(e) { res = null; }
    }
    if (!res || !res.ok) {
      const url = `https://raw.githubusercontent.com/${CN_REPO}/main/${CN_PATH}/${fname}`;
      res = await fetch(url); // no Authorization header
    }
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    // Decompress using pako (already loaded in Autumn)
    const decompressed = typeof pako !== 'undefined'
      ? pako.inflate(new Uint8Array(buf), {to:'string'})
      : new TextDecoder().decode(buf); // fallback if not gzipped somehow
    CN_BUCKETS[bucketName] = JSON.parse(decompressed);
    console.log(`[ConceptNet] Loaded ${bucketName}: ${CN_BUCKETS[bucketName].length} edges`);
    return CN_BUCKETS[bucketName];
  } catch(e) {
    console.warn('[ConceptNet] Load failed:', bucketName, e.message);
    return null;
  }
}

// Query: get all edges for a word
// opts: { rel: 'UsedFor'|'Synonym'|etc, limit: 20, minWeight: 1 }
async function cnQuery(word, opts, token) {
  const w = word.toLowerCase().replace(/\s+/g,'_');
  opts = opts || {};
  const limit = opts.limit || 20;
  const minW  = opts.minWeight || 1.0;
  const relFilter = opts.rel || null;

  // Determine which buckets to search
  const bucketsToSearch = opts.bucket
    ? [opts.bucket]
    : (opts.category === 'language' || !opts.category)
      ? [_cnLangBucket(w), 'everyday', 'causes', 'abstract']
      : [opts.category];

  let results = [];
  for (const bname of bucketsToSearch) {
    const bucket = await _cnLoadBucket(bname, token);
    if (!bucket) continue;
    const matches = bucket.filter(e =>
      (e.s === w || e.e === w) &&
      (e.w >= minW) &&
      (!relFilter || e.r === relFilter)
    );
    results = results.concat(matches);
    if (results.length >= limit) break;
  }

  return results.slice(0, limit).map(e => ({
    relation: e.r,
    start:    e.s.replace(/_/g,' '),
    end:      e.e.replace(/_/g,' '),
    weight:   e.w,
    // Natural language description
    text: _cnDescribe(e.r, e.s.replace(/_/g,' '), e.e.replace(/_/g,' '))
  }));
}

// Natural language descriptions of CN relations
function _cnDescribe(rel, start, end) {
  const d = {
    'UsedFor':       `${start} is used for ${end}`,
    'CapableOf':     `${start} can ${end}`,
    'HasA':          `${start} has ${end}`,
    'IsA':           `${start} is a type of ${end}`,
    'PartOf':        `${start} is part of ${end}`,
    'AtLocation':    `${start} is found at ${end}`,
    'Causes':        `${start} causes ${end}`,
    'CausesDesire':  `${start} makes you want to ${end}`,
    'HasProperty':   `${start} is ${end}`,
    'Synonym':       `${start} means the same as ${end}`,
    'Antonym':       `${start} means the opposite of ${end}`,
    'RelatedTo':     `${start} is related to ${end}`,
    'DerivedFrom':   `${start} comes from ${end}`,
    'SimilarTo':     `${start} is similar to ${end}`,
    'DefinedAs':     `${start} is defined as ${end}`,
    'HasContext':    `${start} is used in the context of ${end}`,
    'MotivatedByGoal': `${start} is motivated by ${end}`,
    'HasPrerequisite': `${start} requires ${end}`,
    'HasSubevent':   `${start} involves ${end}`,
    'desires':       `a person wants ${end}`,
    'ReceivesAction': `${start} can be ${end}`,
    'MadeOf':        `${start} is made of ${end}`,
    'LocatedNear':   `${start} is near ${end}`,
    'MannerOf':      `${start} is a way of ${end}`,
  };
  return d[rel] || `${start} [${rel}] ${end}`;
}

// Quick lookup: what is X used for? what can X do? where is X found?
async function cnAbout(word, token) {
  const results = await cnQuery(word, {limit:30}, token);
  if (!results.length) return null;
  return {
    word,
    facts: results.map(r => r.text),
    edges: results
  };
}

if (typeof module !== 'undefined') {
  module.exports = { cnQuery, cnAbout, _cnLoadBucket };
}
