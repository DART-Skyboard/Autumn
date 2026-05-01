// cn_loader.js — ConceptNet 5.7 lazy bucket loader
// Same pattern as wordnet_loader.js — fetches buckets on demand from leatr-ash
// CC BY SA 4.0 — conceptnet.io

(function(global){
  var CN_BASE = 'https://raw.githubusercontent.com/DART-Skyboard/leatr-ash/main/conceptnet';
  var _cache  = {};    // loaded buckets
  var _pending = {};   // in-flight fetches

  // Normalise a word to ConceptNet key format
  function _norm(word) {
    return word.toLowerCase().replace(/[^a-z0-9 ']/g, ' ').replace(/\s+/g,' ').trim();
  }

  // Load the bucket for a given first letter
  async function _loadBucket(letter) {
    var key = letter || '_';
    if (_cache[key]) return _cache[key];
    if (_pending[key]) return _pending[key];
    _pending[key] = fetch(CN_BASE + '/cn_' + key + '.json')
      .then(function(r){ return r.ok ? r.json() : {}; })
      .then(function(data){ _cache[key] = data; delete _pending[key]; return data; })
      .catch(function(){ delete _pending[key]; return {}; });
    return _pending[key];
  }

  // Look up a word — returns its relation map or {}
  async function lookup(word) {
    var w = _norm(word);
    if (!w) return {};
    var letter = w[0].match(/[a-z]/) ? w[0] : '_';
    var bucket = await _loadBucket(letter);
    return bucket[w] || {};
  }

  // Get all known relations for a word as a flat array of statements
  // e.g. lookup('coffee') -> [{rel:'IsA',end:'beverage'},{rel:'UsedFor',end:'waking up'}]
  async function getRelations(word, relFilter) {
    var map = await lookup(word);
    var out = [];
    for (var rel in map) {
      if (relFilter && !relFilter.includes(rel)) continue;
      var ends = map[rel];
      for (var i = 0; i < ends.length; i++) {
        out.push({ rel: rel, start: word, end: ends[i] });
      }
    }
    return out;
  }

  // Build natural language grounding sentences from ConceptNet relations
  // Used by Autumn's grammar engine to ground conversational responses
  async function groundedContext(word, maxEdges) {
    maxEdges = maxEdges || 8;
    var rels = await getRelations(word, ['IsA','UsedFor','HasProperty','AtLocation',
                                         'CapableOf','Causes','HasSubevent','PartOf',
                                         'RelatedTo','MotivatedByGoal']);
    if (!rels.length) return null;

    // Sort by relation priority — IsA first, then UsedFor, HasProperty...
    var PRIORITY = {IsA:0,UsedFor:1,HasProperty:2,AtLocation:3,
                    CapableOf:4,Causes:5,HasSubevent:6,PartOf:7,
                    RelatedTo:8,MotivatedByGoal:9};
    rels.sort(function(a,b){ return (PRIORITY[a.rel]||99)-(PRIORITY[b.rel]||99); });
    rels = rels.slice(0, maxEdges);

    return {
      word:     word,
      edges:    rels,
      // Pre-built natural language sentences for use in responses
      sentences: rels.map(function(e){
        var tmpl = {
          IsA:             '{{start}} is a type of {{end}}',
          UsedFor:         '{{start}} is used for {{end}}',
          HasProperty:     '{{start}} is {{end}}',
          AtLocation:      '{{start}} is found at {{end}}',
          CapableOf:       '{{start}} can {{end}}',
          Causes:          '{{start}} causes {{end}}',
          HasSubevent:     '{{start}} involves {{end}}',
          PartOf:          '{{start}} is part of {{end}}',
          RelatedTo:       '{{start}} is related to {{end}}',
          MotivatedByGoal: '{{start}} is motivated by {{end}}'
        };
        var t = tmpl[e.rel] || '{{start}} {{rel}} {{end}}';
        return t.replace('{{start}}',e.start).replace('{{end}}',e.end).replace('{{rel}}',e.rel);
      })
    };
  }

  // Preload a letter bucket in the background (call during idle)
  function warmup(letters) {
    (letters||'abcdefghijklmnopqrstuvwxyz').split('').forEach(function(l){
      setTimeout(function(){ _loadBucket(l); }, 50);
    });
  }

  global.ConceptNetLoader = { lookup, getRelations, groundedContext, warmup, _norm };

})(typeof window !== 'undefined' ? window : global);
