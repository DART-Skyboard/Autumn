// code_loader.js — Forge IDE coding reference loader
// Loads language syntax ref + TLDR pages from leatr-ash on demand

(function(global){
  var REF_BASE = 'https://raw.githubusercontent.com/DART-Skyboard/leatr-ash/main/coderef';
  var _syntax  = null;
  var _tldr    = null;
  var _loading = {};

  async function _load(key, url) {
    if (_loading[key]) return _loading[key];
    _loading[key] = fetch(url).then(r=>r.ok?r.json():{}).catch(()=>({}));
    return _loading[key];
  }

  async function getSyntax() {
    if (!_syntax) _syntax = await _load('syntax', REF_BASE+'/lang_syntax.json');
    return _syntax;
  }

  async function getTLDR() {
    if (!_tldr) _tldr = await _load('tldr', REF_BASE+'/tldr.json');
    return _tldr;
  }

  // Get syntax reference for a language
  async function langRef(lang) {
    const syn = await getSyntax();
    const key = lang.toLowerCase().replace(/[^a-z]/g,'');
    return syn[key] || syn[Object.keys(syn).find(k=>k.startsWith(key))] || null;
  }

  // Look up a CLI command in TLDR
  async function tldrLookup(cmd) {
    const db = await getTLDR();
    const key = cmd.toLowerCase().trim();
    return db[key] || db[key.replace(/\s+/g,'-')] || null;
  }

  // Detect language from file extension or code content
  function detectLang(filenameOrCode) {
    const extMap = {'.js':'javascript','.ts':'typescript','.jsx':'react','.tsx':'react',
      '.py':'python','.html':'html','.css':'css','.sh':'bash','.sql':'sql','.json':'json'};
    for(const [ext,lang] of Object.entries(extMap)){
      if(filenameOrCode.endsWith(ext)) return lang;
    }
    // Heuristic from code
    if(/^import\s+\w|from\s+\w+\s+import|def\s+\w+\s*\(|:\s*\n\s{4}/.test(filenameOrCode)) return 'python';
    if(/const\s+\w|let\s+\w|=>\s*\{|async\s+function/.test(filenameOrCode)) return 'javascript';
    if(/<[a-z][^>]*>/.test(filenameOrCode)) return 'html';
    return 'unknown';
  }

  // Build a grounded coding context for Autumn's grammar engine
  // Returns sentences Autumn can use when helping with code
  async function codingContext(query) {
    const words = query.toLowerCase().split(/\s+/);
    const langKeywords = ['javascript','python','html','css','typescript','bash','shell',
                          'sql','react','git','json','node','js','ts','py'];
    const detectedLang = words.find(w=>langKeywords.includes(w)) || null;

    var sentences = [];
    var ref = null;

    if(detectedLang) {
      ref = await langRef(detectedLang === 'js' ? 'javascript'
                        : detectedLang === 'ts' ? 'typescript'
                        : detectedLang === 'py' ? 'python'
                        : detectedLang === 'shell' ? 'bash'
                        : detectedLang === 'node' ? 'javascript'
                        : detectedLang);
      if(ref) {
        sentences.push(ref.name + ' (' + ref.paradigm + ')');
        sentences.push('File extensions: ' + (ref.file_ext||[]).join(', '));
        // Add syntax examples relevant to query
        const syn = ref.syntax || {};
        for(const [category, examples] of Object.entries(syn)){
          if(query.toLowerCase().includes(category) && Array.isArray(examples)){
            sentences.push(category + ': ' + examples[0]);
            break;
          }
        }
        // Add error guidance if query mentions an error
        const errors = ref.errors || {};
        for(const [errType, guidance] of Object.entries(errors)){
          if(query.includes(errType)) {
            sentences.push(errType + ': ' + guidance);
            break;
          }
        }
      }
    }

    // TLDR lookup for CLI commands
    const cmdMatch = query.match(/\b(git|npm|pip|curl|grep|find|sed|awk|docker|kubectl)\s+\w+/i);
    if(cmdMatch) {
      const tldr = await tldrLookup(cmdMatch[0].toLowerCase());
      if(tldr) {
        sentences.push(tldr.d);
        if(tldr.ex && tldr.ex[0]) sentences.push('Example: ' + tldr.ex[0].code);
      }
    }

    return sentences.length ? { lang: detectedLang, ref, sentences } : null;
  }

  global.CodeRefLoader = { langRef, tldrLookup, detectLang, codingContext, getSyntax, getTLDR };

})(typeof window !== 'undefined' ? window : global);
