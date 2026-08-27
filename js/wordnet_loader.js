/**
 * wordnet_loader.js  v1.1
 * © 2025 DART Meadow LLC / Radical Deepscale LLC
 *
 * Loads WordNet 3.1 when the JSON buckets are available locally or as
 * public files. Never attaches GitHub tokens. Private leatr-ash buckets
 * are optional; missing definition data is a journaled boundary, not a
 * fabricated sense.
 *
 * Files (tried in order, no credentials):
 *   wordnet/wordnet_a_h.json   — local public clone
 *   nlp/wordnet/wordnet_a_h.json
 *   assets/wordnet/wordnet_a_h.json
 *   raw.githubusercontent.com/DART-Skyboard/leatr-ash/main/wordnet/  (public only)
 *
 * Per-word fallback: dictionaryapi.dev (already used by Autumn, no key).
 *
 * Each entry: word → [{pos:"noun"|"verb"|"adj"|"adv", def:"...", syn:["...",...]}]
 */

'use strict';

window.AutumnWordNet = (function(){

  const REMOTE_BASE = 'https://raw.githubusercontent.com/DART-Skyboard/leatr-ash/main/wordnet/';
  const LOCAL_BASES = ['wordnet/', 'nlp/wordnet/', 'assets/wordnet/', './wordnet/'];
  const FILES = {
    a: 'wordnet_a_h.json',   // a–h
    i: 'wordnet_i_r.json',   // i–r
    s: 'wordnet_s_z.json'    // s–z
  };

  const _data    = { a: null, i: null, s: null };
  const _loading = { a: false, i: false, s: false };
  const _wordCache = {};
  const _bucketFailed = { a: false, i: false, s: false };

  function _bucket(word) {
    if (!word || !word.length) return null;
    const c = word[0].toLowerCase();
    if (c >= 'a' && c <= 'h') return 'a';
    if (c >= 'i' && c <= 'r') return 'i';
    return 's';
  }

  async function _fetchJson(url) {
    const res = await fetch(url); // never send Authorization / PATs
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function _loadBucket(key) {
    if (_data[key] && Object.keys(_data[key]).length) return _data[key];
    if (_loading[key]) {
      return new Promise(resolve => {
        const interval = setInterval(() => {
          if (!_loading[key]) { clearInterval(interval); resolve(_data[key] || {}); }
        }, 50);
      });
    }
    _loading[key] = true;
    const fname = FILES[key];
    let loaded = null;
    let from = '';

    for (let i = 0; i < LOCAL_BASES.length; i++) {
      try {
        loaded = await _fetchJson(LOCAL_BASES[i] + fname);
        if (loaded && typeof loaded === 'object') { from = LOCAL_BASES[i] + fname; break; }
      } catch (e) { loaded = null; }
    }

    if (!loaded && !_bucketFailed[key]) {
      try {
        loaded = await _fetchJson(REMOTE_BASE + fname);
        if (loaded && typeof loaded === 'object') from = REMOTE_BASE + fname;
      } catch (e) {
        _bucketFailed[key] = true;
        loaded = null;
      }
    }

    _data[key] = (loaded && typeof loaded === 'object') ? loaded : {};
    _loading[key] = false;
    if (from) {
      console.log('[AutumnWordNet] Loaded ' + fname + ' from ' + from +
                  ' (' + Object.keys(_data[key]).length + ' words)');
    } else {
      console.warn('[AutumnWordNet] Bucket ' + fname + ' unavailable locally/publicly. Per-word lookup uses the public dictionary API; unknown words stay a journaled boundary.');
    }
    return _data[key];
  }

  function _preloadLocal() {
    setTimeout(function(){ _loadBucket('a'); }, 200);
    setTimeout(function(){ _loadBucket('i'); }, 800);
    setTimeout(function(){ _loadBucket('s'); }, 1400);
  }

  // Public no-key dictionary API already used by Autumn (composeResponse / lookupWord).
  async function _publicDefine(word) {
    try {
      const res = await fetch(
        'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word),
        { signal: AbortSignal.timeout(4000) }
      );
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data) || !data[0]) return [];
      const entries = [];
      (data[0].meanings || []).forEach(function(m) {
        const def = m.definitions && m.definitions[0] ? m.definitions[0].definition : '';
        if (!def) return;
        const posRaw = m.partOfSpeech || 'noun';
        const pos = posRaw === 'adjective' ? 'adj' : posRaw === 'adverb' ? 'adv' : posRaw;
        entries.push({ pos: pos, def: def, syn: (m.synonyms || []).slice(0, 6), _source: 'dictionaryapi' });
      });
      return entries;
    } catch (e) {
      return [];
    }
  }

  async function lookup(word) {
    if (!word) return [];
    const w = word.toLowerCase().trim().replace(/[^a-z'-]/g, '');
    if (!w) return [];
    if (_wordCache[w]) return _wordCache[w];
    const bk = _bucket(w);
    if (!bk) return [];
    const bucket = await _loadBucket(bk);
    let entries = bucket[w] || [];
    if (!entries.length) {
      entries = await _publicDefine(w);
    }
    _wordCache[w] = entries;
    return entries;
  }

  async function define(word, preferPos) {
    const entries = await lookup(word);
    if (!entries.length) return null;
    if (preferPos) {
      const match = entries.find(e => e.pos === preferPos);
      if (match) return match.def;
    }
    return entries[0].def;
  }

  function defineSync(word, preferPos) {
    if (!word) return null;
    const w = word.toLowerCase().trim().replace(/[^a-z'-]/g, '');
    const entries = _wordCache[w];
    if (!entries || !entries.length) return null;
    if (preferPos) {
      const match = entries.find(e => e.pos === preferPos);
      if (match) return match.def;
    }
    return entries[0].def;
  }

  async function synonyms(word, preferPos) {
    const entries = await lookup(word);
    if (!entries.length) return [];
    if (preferPos) {
      const match = entries.find(e => e.pos === preferPos);
      if (match) return match.syn || [];
    }
    const all = [];
    for (const e of entries) {
      for (const s of (e.syn || [])) {
        if (!all.includes(s) && s !== word.toLowerCase()) all.push(s);
      }
    }
    return all.slice(0, 8);
  }

  async function warmCache(words) {
    await Promise.all((words || []).map(w => lookup(w)));
  }

  function isLoaded(bucketKey) {
    if (bucketKey) return !!(_data[bucketKey] && Object.keys(_data[bucketKey]).length);
    return isLoaded('a') && isLoaded('i') && isLoaded('s');
  }

  _preloadLocal();
  console.log('[AutumnWordNet] Initialised — local/public buckets first, no tokens. Per-word dictionary fallback when buckets are absent.');

  return { lookup, define, defineSync, synonyms, warmCache, isLoaded, _data };

})();
