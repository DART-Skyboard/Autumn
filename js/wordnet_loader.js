/**
 * wordnet_loader.js  v1.0
 * © 2025 DART Meadow LLC / Radical Deepscale LLC
 *
 * Loads WordNet 3.1 (147,442 words) split across 3 JSON files
 * hosted in the leatr-ash repository.
 *
 * Files:
 *   wordnet/wordnet_a_h.json  — words a through h  (66,841 words)
 *   wordnet/wordnet_i_r.json  — words i through r  (46,899 words)
 *   wordnet/wordnet_s_z.json  — words s through z  (33,702 words)
 *
 * Each entry: word → [{pos:"noun"|"verb"|"adj"|"adv", def:"...", syn:["...",...]}]
 *
 * Usage:
 *   await window.AutumnWordNet.lookup("grammar")
 *   → [{pos:"noun", def:"the branch of linguistics...", syn:["syntax","morphology"]}]
 *
 *   window.AutumnWordNet.define("grammar")
 *   → "the branch of linguistics that deals with syntax and morphology"
 *
 *   window.AutumnWordNet.synonyms("happy", "adj")
 *   → ["felicitous","glad","content",...]
 */

'use strict';

window.AutumnWordNet = (function(){

  const BASE = 'https://raw.githubusercontent.com/DART-Skyboard/leatr-ash/main/wordnet/';
  const FILES = {
    a: 'wordnet_a_h.json',   // a–h
    i: 'wordnet_i_r.json',   // i–r
    s: 'wordnet_s_z.json'    // s–z
  };

  // Loaded buckets (null = not yet loaded, {} = loading/loaded)
  const _data    = { a: null, i: null, s: null };
  const _loading = { a: false, i: false, s: false };
  const _wordCache = {};   // word → entries (cross-bucket cache)

  // Determine which bucket a word belongs to
  function _bucket(word) {
    if (!word || !word.length) return null;
    const c = word[0].toLowerCase();
    if (c >= 'a' && c <= 'h') return 'a';
    if (c >= 'i' && c <= 'r') return 'i';
    return 's';
  }

  // Fetch and cache a bucket
  async function _loadBucket(key) {
    if (_data[key]) return _data[key];
    if (_loading[key]) {
      // Wait for in-flight request
      return new Promise(resolve => {
        const interval = setInterval(() => {
          if (_data[key]) { clearInterval(interval); resolve(_data[key]); }
        }, 50);
      });
    }
    _loading[key] = true;
    try {
      const res = await fetch(BASE + FILES[key]);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      _data[key] = await res.json();
      console.log('[AutumnWordNet] Loaded ' + FILES[key] +
                  ' (' + Object.keys(_data[key]).length + ' words)');
    } catch (e) {
      console.warn('[AutumnWordNet] Failed to load ' + FILES[key] + ':', e.message);
      _data[key] = {};
    }
    return _data[key];
  }

  // Preload all 3 buckets in background (called on init)
  function _preloadAll() {
    setTimeout(() => { _loadBucket('a'); }, 200);
    setTimeout(() => { _loadBucket('i'); }, 800);
    setTimeout(() => { _loadBucket('s'); }, 1400);
  }

  /**
   * lookup(word) → Promise<Array<{pos, def, syn}>>
   * Returns all senses for the word across all POS.
   */
  async function lookup(word) {
    if (!word) return [];
    const w = word.toLowerCase().trim();
    if (_wordCache[w]) return _wordCache[w];
    const bk = _bucket(w);
    if (!bk) return [];
    const bucket = await _loadBucket(bk);
    const entries = bucket[w] || [];
    _wordCache[w] = entries;
    return entries;
  }

  /**
   * define(word, preferPos?) → string | null
   * Returns the best single definition for a word.
   * If preferPos given ('noun','verb','adj','adv'), prefers that POS.
   */
  async function define(word, preferPos) {
    const entries = await lookup(word);
    if (!entries.length) return null;
    if (preferPos) {
      const match = entries.find(e => e.pos === preferPos);
      if (match) return match.def;
    }
    return entries[0].def;
  }

  /**
   * Synchronous define — returns from cache only, null if not loaded yet.
   * Use after warmCache() or after lookup() has been called.
   */
  function defineSync(word, preferPos) {
    if (!word) return null;
    const w = word.toLowerCase().trim();
    const entries = _wordCache[w];
    if (!entries || !entries.length) return null;
    if (preferPos) {
      const match = entries.find(e => e.pos === preferPos);
      if (match) return match.def;
    }
    return entries[0].def;
  }

  /**
   * synonyms(word, preferPos?) → Promise<string[]>
   * Returns synonym list for a word.
   */
  async function synonyms(word, preferPos) {
    const entries = await lookup(word);
    if (!entries.length) return [];
    if (preferPos) {
      const match = entries.find(e => e.pos === preferPos);
      if (match) return match.syn || [];
    }
    // Merge all synonyms across senses, deduplicate
    const all = [];
    for (const e of entries) {
      for (const s of (e.syn || [])) {
        if (!all.includes(s) && s !== word.toLowerCase()) all.push(s);
      }
    }
    return all.slice(0, 8);
  }

  /**
   * warmCache(words) — preload a list of words into cache.
   * Good for priming frequently-used topic words.
   */
  async function warmCache(words) {
    await Promise.all(words.map(w => lookup(w)));
  }

  /**
   * isLoaded(bucketKey?) — check load status.
   * bucketKey: 'a', 'i', or 's'. Omit to check if ALL loaded.
   */
  function isLoaded(bucketKey) {
    if (bucketKey) return !!_data[bucketKey];
    return !!_data.a && !!_data.i && !!_data.s;
  }

  // Start preloading on init
  _preloadAll();
  console.log('[AutumnWordNet] Initialised — 147,442 words across 3 buckets. Preloading...');

  return { lookup, define, defineSync, synonyms, warmCache, isLoaded, _data };

})();
