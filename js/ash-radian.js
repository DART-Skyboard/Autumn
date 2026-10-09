// Tool Radian host: encode data points into reflexive variable state (tool + kind + angle), condense them into the training file,
// and decode them for analysis / generation. Integers only (angles are tenths of a degree). No outside AI, no network, no eval.
//   state  <tool>[f]<kind><angle>   md-0.1  mdb0.1  md0.0  mfdb0.0       limit: |angle| <= 45.0 degrees (1/8 of a diameter)
//   ONE angle per data point carries its whole context (reflex states, emotion, tools, shells). Two data points may share a state: that is allowed.
//   When they must be told apart the angle gains decimal places (up to 6), proportional to their context / sequence position. No extra types.
(function (global) {
  'use strict';
  var TOOLS = { m: 'Maze', p: 'Puzzle', e: 'Envelope', h: 'Hammer', s: 'Stick', k: 'Knife', r: 'Scissors' };
  var LIMIT = 450;                                        // 45.0 degrees in tenths; at precision p the limit is 45 * 10^p units
  var MAXPREC = 6;                                        // decimal places of the angle (1 = tenths of a degree, the default)
  function pow10(n) { return Math.pow(10, n); }
  var PUNCT = '+-*/^%()<>,.:;!?';                         // operators / relations / punctuation share Maze, kind "both" (magnitude = position, + = 0.1)
  var WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  var STATE = /^([mpehskr])(f?)(d-|d\+|db-?|d)(\d{1,3}\.\d{1,6})$/;
  var LINE = /^(\s*irin \("Radian: )v=(\S+) d=(\S*) n=(\d+)( src=[^"]*)?("\)\s*)$/;

  function contract(text) {                               // optional: read seeds from tool-radian.ash (data, not hardcoded)
    var c = { tools: TOOLS, limit: LIMIT, punct: PUNCT };
    (text || '').split('\n').forEach(function (ln) {
      var m = /irin \("Data: (.*)"\)/.exec(ln); if (!m) return;
      m[1].split(/ (?=\w+=)/).forEach(function (kv) {
        var i = kv.indexOf('='), k = kv.slice(0, i), v = kv.slice(i + 1);
        if (k === 'limit' && /^\d+$/.test(v)) c.limit = Math.min(+v, 450);
        if (k === 'punct' && v) c.punct = v;
        if (k === 'tools') { var t = {}; v.split(' ').forEach(function (p) { var q = p.split(':'); if (q[0].length === 1 && q[1]) t[q[0]] = q[1]; }); if (Object.keys(t).length) c.tools = t; }
      });
    });
    return c;
  }

  // ── state ──  mag is the angle magnitude in units of 10^-prec degrees (prec 1 = tenths, up to 6)
  function clamp(mag, prec) { return Math.max(0, Math.min(45 * pow10(prec), Math.round(mag))); }
  function fixed(mag, prec) { var u = pow10(prec), f = String(mag % u); while (f.length < prec) f = '0' + f; return Math.floor(mag / u) + '.' + f; }
  // kind: '-' data, '+' data that can build, 'b' both, '0' neutral. neg only matters for kind 'b'.
  function make(tool, field, kind, mag, neg, prec) {
    prec = prec || 1; var m = clamp(mag, prec), clamped = Math.round(mag) > 45 * pow10(prec);
    if (kind === '0') m = 0;
    return { tool: tool, field: !!field, kind: kind, mag: m, prec: prec, neg: kind === '-' ? true : (kind === 'b' ? !!neg : false), clamped: clamped };
  }
  function deg10(s) { return (s.neg ? -1 : 1) * s.mag; }                                            // signed, in units of 10^-prec
  function scaled(s, P) { return deg10(s) * pow10(P - s.prec); }                                    // signed, at working precision P
  function format(s) {
    var k = s.kind === '-' ? 'd-' : s.kind === '+' ? 'd+' : s.kind === 'b' ? 'db' + (s.neg && s.mag ? '-' : '') : 'd';
    return s.tool + (s.field ? 'f' : '') + k + fixed(s.mag, s.prec);
  }
  function parseState(str) {
    var m = STATE.exec(String(str || '')); if (!m) return null;
    var kd = m[3], parts = m[4].split('.'), prec = parts[1].length, mag = parseInt(parts[0] + parts[1], 10);
    if (mag > 45 * pow10(prec)) return null;               // beyond 1/8 of a diameter is not a legal assignment
    var kind = kd === 'd-' ? '-' : kd === 'd+' ? '+' : kd === 'd' ? '0' : 'b';
    if (kind === '0' && mag !== 0) return null;
    return { tool: m[1], field: m[2] === 'f', kind: kind, mag: mag, prec: prec, neg: kind === '-' || kd === 'db-' };
  }

  // ── data-point assignment: seed table, optionally refined by the mean of the context angles (reflex states / emotion) ──
  function seed(ch) {
    if (ch >= '0' && ch <= '9') return make('m', false, '-', (+ch) * 1);                 // integers: Maze data, -0.d degrees
    if (ch === '=') return make('m', false, '0', 0);                                       // equals: Maze neutral 0.0
    var p = PUNCT.indexOf(ch); if (p >= 0) return make('m', false, 'b', p + 1, false);     // operators etc: Maze both
    if (/[a-z]/.test(ch)) return make('e', false, '+', ch.charCodeAt(0) - 96);             // letters: Envelope, data that can build
    if (/[A-Z]/.test(ch)) return make('e', false, '+', 30 + ch.charCodeAt(0) - 64);
    var cp = ch.charCodeAt(0); return make('e', false, 'b', cp % 451, false);              // anything else: Envelope both
  }
  function mean(a, den) { var t = 0; a.forEach(function (x) { t += x; }); return a.length ? Math.trunc(t / (a.length * den)) : 0; }
  // contexts: signed tenths from the remaining reflex states / emotional contexts. The assigned angle is the mean of them with the seed,
  // worked out at the requested precision (prec 1 = tenths; more places separate data points that would otherwise share a state).
  function assign(ch, contexts, prec) {
    prec = prec || 1; var s = seed(ch);
    if (s.kind === '0') return s;
    var arr = [deg10(s)].concat(contexts || []), m = mean(arr.map(function (x) { return x * pow10(prec - 1); }), 1);
    if (!contexts || !contexts.length) m = deg10(s) * pow10(prec - 1);
    return make(s.tool, false, s.kind, Math.abs(m), m < 0, prec);
  }
  function encodeChar(ch, contexts, prec) { return format(assign(ch, contexts, prec)); }

  // ── sequences (fields) ──
  function stripOuter(t) { t = String(t).trim(); return (t.charAt(0) === '(' && t.charAt(t.length - 1) === ')') ? t.slice(1, -1) : t; }
  function tokens(text) { return stripOuter(text).replace(/\s+/g, '').split(''); }
  function fieldState(members, prec) {                     // members = parsed states; field = mean angle, kind both if mixed
    prec = prec || 1;
    var P = Math.max(prec, members.reduce(function (x, m) { return Math.max(x, m.prec); }, 1));
    var hasMath = members.some(function (s) { return s.tool === 'm'; });
    var kinds = {}; members.forEach(function (s) { kinds[s.kind] = 1; });
    var both = kinds.b || (kinds['-'] && kinds['+']);
    var kind = both ? 'b' : (kinds['-'] ? '-' : kinds['+'] ? '+' : '0');
    var m = mean(members.map(function (x) { return scaled(x, P); }), 1);
    return make(hasMath ? 'm' : 'e', true, kind, Math.abs(m), m < 0, prec >= P ? prec : P);
  }
  // text -> { text, tokens:[{ch,state}], field } (outer "( )" is the sequence wrapper, not a member)
  function encode(text, contexts, prec) {
    var body = stripOuter(text).replace(/\s+/g, ''), toks = body.split('').map(function (ch) { return { ch: ch, state: assign(ch, contexts, prec) }; });
    return { text: '(' + body + ')', tokens: toks.map(function (t) { return { ch: t.ch, state: format(t.state) }; }),
             field: toks.length ? format(fieldState(toks.map(function (t) { return t.state; }), prec)) : null };
  }

  // ── decode: state -> what it means (seed inverse; training records can add the most-seen text for the same state) ──
  function inverse(s) {                                    // seed characters sharing tool/kind/magnitude
    var out = [], all = '0123456789=' + PUNCT + 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    all.split('').forEach(function (ch) { var q = seed(ch); if (q.tool === s.tool && q.kind === s.kind && q.mag * pow10(s.prec - 1) === s.mag && q.neg === s.neg) out.push(ch); });
    return out;
  }
  function describeChar(ch) {
    if (/[0-9]/.test(ch)) return 'an integer';
    if (ch === '=') return 'an equals (relation)';
    if (PUNCT.indexOf(ch) >= 0) return 'an operator or punctuation mark';
    if (/[A-Za-z]/.test(ch)) return 'a letter';
    return 'a symbol';
  }
  function decode(str, table) {
    var s = parseState(str); if (!s) return null;
    var cands = inverse(s), seen = (table && table.byState && table.byState[str]) || null;
    var best = seen && seen.length ? seen[0].d : (cands[0] || null);
    var deg = (s.neg ? -1 : 1) * s.mag / pow10(s.prec);
    return { state: str, tool: TOOLS[s.tool], field: s.field, kind: s.kind, deg: (s.neg && s.mag ? '-' : '') + fixed(s.mag, s.prec), degrees: deg,
             candidates: cands, common: !!(seen && seen[0] && seen[0].n >= 2), meaning: best };
  }

  // ── training file (condensed): one line per distinct state+text with a count ──
  var HEAD = '(ToolRadianTraining):-: {\n  // Tool Radian training file: data points condensed into reflexive variable state. Decode with scripts/ash/ash-radian.js.\n  // v=<tool>[f]<kind><angle> d=<text, %XX-escaped> n=<times seen>. Integers/tenths only. Edit by re-condensing, not by hand.\n  var (radian.count)\n';
  var TAIL = "}|';'|\n";
  function esc(t) { return String(t).replace(/[^A-Za-z0-9+\-*\/^=().,:;<>!?]/g, function (c) { return '%' + ('0' + c.charCodeAt(0).toString(16)).slice(-2).toUpperCase(); }); }
  function unesc(t) { return t.replace(/%([0-9A-F]{2})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); }); }
  function parse(text) {
    var recs = [], lines = String(text || '').split('\n');
    lines.forEach(function (ln, i) {
      var m = LINE.exec(ln); if (m) recs.push({ i: i, pre: m[1], v: m[2], d: unesc(m[3]), n: +m[4], src: (m[5] || '').trim().replace(/^src=/, ''), post: m[6] });
    });
    var byState = {}, byText = {};
    recs.forEach(function (r) { (byState[r.v] = byState[r.v] || []).push(r); byText[r.d] = r; });
    Object.keys(byState).forEach(function (k) { byState[k].sort(function (a, b) { return b.n - a.n; }); });
    return { recs: recs, byState: byState, byText: byText, lines: lines };
  }
  function serialize(tb) {
    var body = tb.recs.map(function (r) { return '  irin ("Radian: v=' + r.v + ' d=' + esc(r.d) + ' n=' + r.n + (r.src ? ' src=' + String(r.src).replace(/["\n]/g, ' ') : '') + '")'; });
    return HEAD + body.join('\n') + (body.length ? '\n' : '') + TAIL;
  }
  function empty() { return parse(HEAD + TAIL); }
  // add data: every character becomes a data-point state, every sequence a field. Repeats only raise the count (condensity).
  // Sharing a state is allowed. With opt.separate, a data point whose state is already held by DIFFERENT text gains decimal places
  // (up to 6) until its state is its own: the same single angle, finer, never a new type.
  function add(tb, text, opt) {
    opt = opt || {}; var max = opt.maxBytes || 200000, src = opt.src || '';
    var body = stripOuter(text).replace(/\s+/g, ''), enc = encode(body, opt.contexts, 1);
    function bump(v, d, source) {
      var k = tb.recs.filter(function (r) { return r.v === v && r.d === d; })[0];
      if (k) { k.n++; return; }
      var rec = { v: v, d: d, n: 1, src: source || '' }; tb.recs.push(rec); (tb.byState[v] = tb.byState[v] || []).push(rec); tb.byText[d] = rec;
    }
    function taken(v, d) { return tb.recs.some(function (r) { return r.v === v && r.d !== d; }); }
    function place(d, build, source) {
      var v = build(1);
      for (var p = 2; opt.separate && p <= MAXPREC && taken(v, d); p++) v = build(p);
      bump(v, d, source);
    }
    body.split('').forEach(function (ch) { place(ch, function (p) { return encodeChar(ch, opt.contexts, p); }, ''); });
    if (enc.field && body.length > 1 && serialize(tb).length < max)   // sequences stop growing the file at its cap
      place(enc.text, function (p) { return encode(body, opt.contexts, p).field; }, src);
    return enc;
  }

  // ── analysis + generation ──
  // integer-only expression evaluator (no eval): + - * / ^ ( ) and unary minus; "/" must divide exactly or yields a fraction a/b.
  function evaluate(src) {
    var s = String(src).replace(/\s+/g, ''), i = 0;
    function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a || 1; }
    function fr(n, d) { if (d < 0) { n = -n; d = -d; } var g = gcd(n, d); return { n: n / g, d: d / g }; }
    function ok(f) { if (Math.abs(f.n) > 1e15 || f.d > 1e15) throw 0; return f; }
    function num() {
      if (s[i] === '-') { i++; var f = prim(); return fr(-f.n, f.d); }
      if (s[i] === '+') { i++; return prim(); }
      return prim();
    }
    function prim() {
      if (s[i] === '(') { i++; var f = add(); if (s[i] !== ')') throw 0; i++; return f; }
      var st = i; while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
      if (st === i) throw 0; return fr(+s.slice(st, i), 1);
    }
    function pow() { var b = num(); if (s[i] === '^') { i++; var e = pow(); if (e.d !== 1 || e.n < 0 || e.n > 64) throw 0; var r = fr(1, 1); for (var k = 0; k < e.n; k++) r = ok(fr(r.n * b.n, r.d * b.d)); return r; } return b; }
    function mul() { var f = pow(); while (s[i] === '*' || s[i] === '/') { var o = s[i++], g = pow(); if (o === '/' && g.n === 0) throw 0; f = ok(o === '*' ? fr(f.n * g.n, f.d * g.d) : fr(f.n * g.d, f.d * g.n)); } return f; }
    function add() { var f = mul(); while (s[i] === '+' || s[i] === '-') { var o = s[i++], g = mul(); f = ok(o === '+' ? fr(f.n * g.d + g.n * f.d, f.d * g.d) : fr(f.n * g.d - g.n * f.d, f.d * g.d)); } return f; }
    try { if (s.slice(-1) === '=') s = s.slice(0, -1); var r = add(); if (i !== s.length) return null; return r.d === 1 ? String(r.n) : r.n + '/' + r.d; } catch (e) { return null; }
  }
  // Analyse a prompt: encode it, decode each data point (with the training file as context), then complete / solve it.
  function analyze(text, table) {
    table = table || empty();
    var enc = encode(text), body = enc.text.slice(1, -1), lines = [];
    enc.tokens.forEach(function (t) {
      var d = decode(t.state, table); if (!d) return;
      lines.push('Data of ' + d.tool + ' at ' + d.deg + ' degrees - ' + (d.common ? 'Common Context' : 'New Context') + ', Presumably ' + describeChar(d.meaning || t.ch) + ' = ' + t.ch);
    });
    if (enc.field) lines.push('Sequence ' + enc.field + ' over ' + enc.tokens.length + ' variable states: ' + enc.text);   // second stair step: the sequence assignment
    // completion: the prompt is a piece of a trained sequence -> that sequence is the statement
    var statement = null;
    table.recs.forEach(function (r) { if (!statement && r.v.charAt(1) === 'f' && r.d.length > 2 && r.d.slice(1, -1).indexOf(body) >= 0 && body.length) statement = r.d.slice(1, -1); });
    var whole = statement || body, answer = /[0-9]/.test(whole) ? evaluate(whole) : null;
    var lead = enc.tokens.filter(function (t) { return /[0-9]/.test(t.ch); })[0], response;
    if (answer !== null && lead) {
      var full = whole.replace(/=$/, '') + '=' + answer;
      response = '(' + lead.ch + ', ' + WORDS[+lead.ch] + ', Integer ' + lead.ch + ' ' + (statement ? 'completes the statement' : 'solves the statement') + ': ' + full + ')';
    } else if (answer !== null) { response = '(' + whole.replace(/=$/, '') + '=' + answer + ')'; }
    else response = '(' + (enc.tokens.length ? enc.tokens.length + ' data points reflexed' + (enc.field ? ' as field ' + enc.field : '') : 'nothing to analyze') + ')';
    return { prompt: text, encoded: enc, analysis: lines, response: response, answer: answer, statement: statement };
  }

  // Shell 64 / Ash Canvas bridge: a Shell 64 record reads as a Tool Radian state. Kind from its own variable state, angle = 45 degrees / 7 depth levels.
  function fromRecord(r) {
    var tool = ({ Maze: 'm', Puzzle: 'p', Envelope: 'e', Hammer: 'h', Stick: 's', Knife: 'k', Scissors: 'r' })[r.t] || 'e';
    var kind = r.bl === 0 ? '-' : (r.rbli >= 1 ? '+' : 'b');
    return format(make(tool, false, kind, Math.min(r.bl, 7) * 64, false));   // 7 levels x 6.4 deg = 44.8 <= 45.0
  }

  global.AshRadian = { TOOLS: TOOLS, LIMIT: LIMIT, contract: contract, seed: seed, assign: assign, encodeChar: encodeChar, encode: encode, decode: decode,
    MAXPREC: MAXPREC, parseState: parseState, format: format, parse: parse, serialize: serialize, empty: empty, add: add, evaluate: evaluate, analyze: analyze, fromRecord: fromRecord };
  if (typeof module !== 'undefined') module.exports = global.AshRadian;
})(typeof window !== 'undefined' ? window : globalThis);
