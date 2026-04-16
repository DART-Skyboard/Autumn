#!/usr/bin/env python3
"""
autumn_scrape.py
Autumn NLP External Data Normalizer
DART Meadow / Radical Deepscale — LEATR v2

Converts any input document (article, journal, book excerpt, blog post,
technical doc, user upload) into the standard Autumn NLP JSON schema.

Supports:
  - Plain text files (.txt)
  - Markdown files (.md)
  - HTML files (.html) — strips tags
  - PDF files (.pdf) — requires pymupdf or pdfplumber
  - EPUB files (.epub) — requires ebooklib
  - JSON / existing records — re-normalizes

Usage:
  python3 autumn_scrape.py --input <file_or_url> --type <doc_type> --genre <genre> [--output <path>]
  python3 autumn_scrape.py --batch <directory> --output-dir <output_dir>

Example:
  python3 autumn_scrape.py --input ./papers/aerospike.pdf --type journal --genre aerospace
  python3 autumn_scrape.py --batch ./uploads/ --output-dir ./nlp-records/
"""

import argparse
import json
import os
import re
import sys
import math
import string
import hashlib
from datetime import datetime, timezone
from collections import Counter
from pathlib import Path

# ─── LEATR CONSTANTS ─────────────────────────────────────────────────────────

LEATR_TOOLS = {
    "MAZE":     {"index": 1, "buoyancy": 1.00, "vowel": "a", "consonant_class": "approximants"},
    "PUZZLE":   {"index": 2, "buoyancy": 0.88, "vowel": "e", "consonant_class": "stops"},
    "ENVELOPE": {"index": 3, "buoyancy": 0.76, "vowel": "o", "consonant_class": "nasals"},
    "HAMMER":   {"index": 4, "buoyancy": 0.64, "vowel": "a", "consonant_class": "stops"},
    "STICK":    {"index": 5, "buoyancy": 0.52, "vowel": "i", "consonant_class": "liquids"},
    "KNIFE":    {"index": 6, "buoyancy": 0.40, "vowel": "i", "consonant_class": "fricatives"},
    "SCISSORS": {"index": 7, "buoyancy": 0.28, "vowel": "u", "consonant_class": "affricates"},
}

BRPN_SHELLS = {
    "GEOLOGICAL": {"primary_tools": ["MAZE","SCISSORS"], "weight": 1.0},
    "MARITIME":   {"primary_tools": ["PUZZLE","ENVELOPE","STICK"],      "weight": 0.72},
    "AEROSPACE":  {"primary_tools": ["HAMMER","KNIFE"],                 "weight": 0.44},
}

VOWELS = set("aeiouAEIOU")
CONSONANT_CLASSES = {
    "stops":       set("pbtdkg"),
    "fricatives":  set("fvszh"),
    "nasals":      set("mn"),
    "liquids":     set("lr"),
    "affricates":  set("j"),
    "approximants":set("wy"),
}

EMOTION_VOCAB = {
    "happy":       {"category":"EMO_POS","tool":"STICK",    "xa":5},
    "love":        {"category":"EMO_POS","tool":"ENVELOPE", "xa":3},
    "inspiring":   {"category":"EMO_POS","tool":"HAMMER",   "xa":4},
    "determined":  {"category":"EMO_POS","tool":"HAMMER",   "xa":4},
    "spiritual":   {"category":"EMO_POS","tool":"MAZE",     "xa":1},
    "guiding":     {"category":"EMO_POS","tool":"STICK",    "xa":5},
    "angry":       {"category":"EMO_NEG","tool":"HAMMER",   "xa":4},
    "hateful":     {"category":"EMO_NEG","tool":"KNIFE",    "xa":6},
    "forgiving":   {"category":"EMO_NEG","tool":"ENVELOPE", "xa":3},
    "condescending":{"category":"EMO_NEG","tool":"KNIFE",   "xa":6},
    "disrespectful":{"category":"EMO_NEG","tool":"SCISSORS","xa":7},
    "neutral":     {"category":"EMO_NEU","tool":"MAZE",     "xa":1},
    "sad":         {"category":"EMO_NEU","tool":"SCISSORS", "xa":7},
    "worried":     {"category":"EMO_NEU","tool":"PUZZLE",   "xa":2},
    "jealous":     {"category":"EMO_NEU","tool":"PUZZLE",   "xa":2},
    "lucrative":   {"category":"EMO_NEU","tool":"KNIFE",    "xa":6},
    "concerned":   {"category":"EMO_NEU","tool":"ENVELOPE", "xa":3},
    "judgemental": {"category":"EMO_NEU","tool":"KNIFE",    "xa":6},
}

SIG_PATTERNS = {
    "SIG_D":  {"name":"declarative",   "markers":[".",  " is "," are "," was "]},
    "SIG_Q":  {"name":"interrogative", "markers":["?"]},
    "SIG_E":  {"name":"exclamatory",   "markers":["!"]},
    "SIG_I":  {"name":"imperative",    "markers":["Do ","Don't","Please","Stop","Start","Get"]},
    "SIG_C":  {"name":"compound",      "markers":[" and "," but "," or "," yet "," so "]},
    "SIG_X":  {"name":"complex",       "markers":["because","although","however","therefore","whereas"]},
    "SIG_F":  {"name":"fragment",      "markers":[]},
    "SIG_RQ": {"name":"rhetorical",    "markers":["Isn't it","Don't you think","Wouldn't","Can't we"]},
}

ID_PREFIXES = {
    "article":"ART","journal":"JNL","book":"BK","blog":"BLG",
    "technical":"TDC","educational":"EDU","script":"SCR",
    "podcast":"POD","survey":"SRV","interview":"INT","user_upload":"USR",
}

# ─── TEXT EXTRACTION ──────────────────────────────────────────────────────────

def extract_text_from_file(filepath: str) -> str:
    ext = Path(filepath).suffix.lower()
    if ext in [".txt", ".md"]:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    elif ext == ".html":
        return extract_from_html(filepath)
    elif ext == ".pdf":
        return extract_from_pdf(filepath)
    elif ext == ".epub":
        return extract_from_epub(filepath)
    elif ext == ".json":
        with open(filepath, "r") as f:
            d = json.load(f)
        return d.get("content_summary", {}).get("summary", "") or str(d)
    else:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            return f.read()

def extract_from_html(filepath: str) -> str:
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        raw = f.read()
    raw = re.sub(r"<script[^>]*>.*?</script>", " ", raw, flags=re.DOTALL|re.IGNORECASE)
    raw = re.sub(r"<style[^>]*>.*?</style>",  " ", raw, flags=re.DOTALL|re.IGNORECASE)
    raw = re.sub(r"<[^>]+>", " ", raw)
    return re.sub(r"\s+", " ", raw).strip()

def extract_from_pdf(filepath: str) -> str:
    try:
        import fitz
        doc = fitz.open(filepath)
        return "\n".join(page.get_text() for page in doc)
    except ImportError:
        pass
    try:
        import pdfplumber
        with pdfplumber.open(filepath) as pdf:
            return "\n".join(p.extract_text() or "" for p in pdf.pages)
    except ImportError:
        print("[WARN] No PDF library found. Install pymupdf or pdfplumber.")
        return ""

def extract_from_epub(filepath: str) -> str:
    try:
        import ebooklib
        from ebooklib import epub
        from io import StringIO
        book = epub.read_epub(filepath)
        texts = []
        for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
            raw = item.get_content().decode("utf-8", errors="replace")
            texts.append(extract_from_html_string(raw))
        return "\n".join(texts)
    except ImportError:
        print("[WARN] ebooklib not installed.")
        return ""

def extract_from_html_string(raw: str) -> str:
    raw = re.sub(r"<[^>]+>", " ", raw)
    return re.sub(r"\s+", " ", raw).strip()

# ─── LINGUISTIC ANALYSIS ─────────────────────────────────────────────────────

def analyze_vowels(text: str) -> dict:
    text_lower = text.lower()
    total_letters = sum(1 for c in text_lower if c.isalpha())
    if total_letters == 0:
        return {"a":0,"e":0,"i":0,"o":0,"u":0}
    return {v: round(text_lower.count(v) / total_letters, 4) for v in "aeiou"}

def analyze_consonants(text: str) -> dict:
    text_lower = text.lower()
    total_letters = sum(1 for c in text_lower if c.isalpha() and c not in VOWELS)
    if total_letters == 0:
        return {cls: 0 for cls in CONSONANT_CLASSES}
    result = {}
    for cls, chars in CONSONANT_CLASSES.items():
        count = sum(text_lower.count(c) for c in chars)
        result[cls] = round(count / total_letters, 4)
    return result

def analyze_punctuation(text: str) -> tuple:
    pmap = {
        "P_PERIOD": text.count("."),
        "P_QUESTION": text.count("?"),
        "P_EXCLAIM": text.count("!"),
        "P_COMMA": text.count(","),
        "P_SEMI": text.count(";"),
        "P_COLON": text.count(":"),
        "P_ELLIPSIS": text.count("..."),
        "P_DASH": text.count("-"),
        "P_QUOTE": text.count('"'),
    }
    total_punct = sum(pmap.values())
    density = round((total_punct / max(len(text), 1)) * 100, 2)
    return pmap, density

def analyze_sentences(text: str) -> tuple:
    sentences = re.split(r"[.!?]+", text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 5]
    if not sentences:
        return 0.0, "SIG_D", {}
    lengths = [len(s.split()) for s in sentences]
    avg_len = round(sum(lengths) / len(lengths), 1)
    sig_counts = Counter()
    for s in sentences:
        sig = classify_sig(s)
        sig_counts[sig] += 1
    dominant_sig = sig_counts.most_common(1)[0][0] if sig_counts else "SIG_D"
    total = sum(sig_counts.values())
    sig_dist = {k: round(v/total, 3) for k,v in sig_counts.items()}
    return avg_len, dominant_sig, sig_dist

def classify_sig(sentence: str) -> str:
    s = sentence.strip()
    if s.endswith("?"):
        for m in SIG_PATTERNS["SIG_RQ"]["markers"]:
            if s.startswith(m):
                return "SIG_RQ"
        return "SIG_Q"
    if s.endswith("!"):
        return "SIG_E"
    for m in SIG_PATTERNS["SIG_I"]["markers"]:
        if s.startswith(m):
            return "SIG_I"
    for m in SIG_PATTERNS["SIG_X"]["markers"]:
        if m.lower() in s.lower():
            return "SIG_X"
    for m in SIG_PATTERNS["SIG_C"]["markers"]:
        if m in s:
            return "SIG_C"
    words = s.split()
    if len(words) < 4:
        return "SIG_F"
    return "SIG_D"

def infer_tense_distribution(text: str) -> dict:
    tense_patterns = {
        "present_simple":    [r"\b(is|are|am|do|does|have|has)\b"],
        "present_continuous":[r"\b(is|are|am)\s+\w+ing\b"],
        "past_simple":       [r"\b(was|were|did|had|went|came|said|made)\b"],
        "past_continuous":   [r"\b(was|were)\s+\w+ing\b"],
        "future_simple":     [r"\b(will|shall|going to)\b"],
        "future_continuous": [r"\bwill be \w+ing\b"],
        "conditional":       [r"\b(would|could|might|should)\b"],
        "imperative":        [r"^(Do|Don't|Please|Stop|Start|Make|Get|Take)\b"],
        "interrogative":     [r"\?"],
        "subjunctive":       [r"\b(were I|if I were|as if|as though|lest)\b"],
    }
    counts = {}
    for tense, patterns in tense_patterns.items():
        count = 0
        for p in patterns:
            count += len(re.findall(p, text, re.IGNORECASE))
        counts[tense] = count
    total = sum(counts.values()) or 1
    return {k: round(v/total, 3) for k,v in counts.items() if v > 0}

# ─── BRPN INFERENCE ──────────────────────────────────────────────────────────

def infer_shell(vowel_freq: dict, consonant_freq: dict, tense_dist: dict) -> tuple:
    scores = {"GEOLOGICAL": 0.0, "MARITIME": 0.0, "AEROSPACE": 0.0}
    scores["GEOLOGICAL"] += vowel_freq.get("a", 0) * 2
    scores["GEOLOGICAL"] += tense_dist.get("past_simple", 0) * 3
    scores["GEOLOGICAL"] += tense_dist.get("subjunctive", 0) * 2
    scores["MARITIME"]   += vowel_freq.get("o", 0) * 2
    scores["MARITIME"]   += tense_dist.get("present_simple", 0) * 2
    scores["MARITIME"]   += tense_dist.get("conditional", 0) * 2
    scores["AEROSPACE"]  += vowel_freq.get("i", 0) * 2
    scores["AEROSPACE"]  += tense_dist.get("future_simple", 0) * 3
    scores["AEROSPACE"]  += tense_dist.get("imperative", 0) * 2
    scores["AEROSPACE"]  += consonant_freq.get("fricatives", 0) * 1.5
    best = max(scores, key=scores.get)
    total = sum(scores.values()) or 1
    confidence = round(scores[best] / total, 3)
    return best, confidence

def infer_dominant_tool(consonant_freq: dict, sig_dist: dict, shell: str) -> tuple:
    tool_scores = {t: 0.0 for t in LEATR_TOOLS}
    consonant_tool_map = {
        "approximants": "MAZE", "stops": "PUZZLE",
        "nasals": "ENVELOPE", "liquids": "STICK",
        "fricatives": "KNIFE", "affricates": "SCISSORS",
    }
    for cls, tool in consonant_tool_map.items():
        tool_scores[tool] += consonant_freq.get(cls, 0) * 2
    sig_tool_map = {
        "SIG_D": "MAZE", "SIG_Q": "PUZZLE", "SIG_I": "HAMMER",
        "SIG_C": "STICK", "SIG_X": "KNIFE", "SIG_F": "SCISSORS",
        "SIG_E": "HAMMER", "SIG_RQ": "SCISSORS",
    }
    for sig, weight in sig_dist.items():
        if sig in sig_tool_map:
            tool_scores[sig_tool_map[sig]] += weight * 3
    for t in BRPN_SHELLS[shell]["primary_tools"]:
        tool_scores[t] += 0.2
    best = max(tool_scores, key=tool_scores.get)
    total = sum(tool_scores.values()) or 1
    dist = {k: round(v/total, 3) for k,v in tool_scores.items()}
    return best, dist

def infer_buoyancy_state(shell: str, dominant_tool: str) -> str:
    if shell == "GEOLOGICAL" or dominant_tool in ["MAZE","SCISSORS"]:
        return "FOUNDATION"
    elif shell == "MARITIME" or dominant_tool in ["PUZZLE","ENVELOPE","STICK"]:
        return "REFLEXIVE"
    else:
        return "PERFORMANCE"

def infer_expression_layer(sig_dist: dict) -> int:
    if "SIG_X" in sig_dist and sig_dist["SIG_X"] > 0.1:
        return 4
    if "SIG_Q" in sig_dist or "SIG_RQ" in sig_dist:
        return 2
    if "SIG_E" in sig_dist and sig_dist.get("SIG_E",0) > 0.1:
        return 3
    return 1

# ─── EMOTION INFERENCE ───────────────────────────────────────────────────────

def infer_emotion(shell: str, dominant_tool: str, expression_layer: int) -> tuple:
    routing = {
        ("GEOLOGICAL","MAZE"):     ("spiritual",    ["concerned","neutral","guiding"]),
        ("GEOLOGICAL","SCISSORS"): ("sad",          ["forgiving","judgemental","spiritual"]),
        ("GEOLOGICAL","ENVELOPE"): ("concerned",    ["forgiving","love","neutral"]),
        ("GEOLOGICAL","KNIFE"):    ("judgemental",  ["condescending","neutral","sad"]),
        ("MARITIME",  "PUZZLE"):   ("worried",      ["curious","jealous","neutral"]),
        ("MARITIME",  "STICK"):    ("guiding",      ["happy","love","inspiring"]),
        ("MARITIME",  "ENVELOPE"): ("love",         ["guiding","happy","concerned"]),
        ("MARITIME",  "MAZE"):     ("happy",        ["neutral","guiding","spiritual"]),
        ("AEROSPACE", "HAMMER"):   ("determined",   ["angry","inspiring","condescending"]),
        ("AEROSPACE", "KNIFE"):    ("condescending",["judgemental","lucrative","neutral"]),
        ("AEROSPACE", "PUZZLE"):   ("lucrative",    ["determined","jealous","worried"]),
        ("AEROSPACE", "SCISSORS"): ("disrespectful",["hateful","angry","sad"]),
    }
    key = (shell, dominant_tool)
    if key in routing:
        primary, secondary = routing[key]
    else:
        primary, secondary = "neutral", ["concerned","guiding"]
    category = EMOTION_VOCAB.get(primary, {}).get("category", "EMO_NEU")
    dist = {primary: 0.50}
    for i, emo in enumerate(secondary):
        dist[emo] = round(0.20 - i*0.05, 2)
    return primary, category, dist

def map_expression_context(layer: int) -> str:
    return {1:"contextual_statement", 2:"question", 3:"expression", 4:"sigmatic_sequence"}.get(layer, "contextual_statement")

# ─── CONTENT EXTRACTION ──────────────────────────────────────────────────────

def extract_key_concepts(text: str, n: int = 10) -> list:
    words = re.findall(r"\b[A-Z][a-z]{3,}\b|\b[a-z]{5,}\b", text)
    stopwords = {"that","this","with","have","from","they","will","been","were","their",
                 "which","when","also","into","would","could","there","about","these",
                 "those","such","than","then","some","more","very","just","over","only"}
    filtered = [w.lower() for w in words if w.lower() not in stopwords]
    return [w for w,_ in Counter(filtered).most_common(n)]

def extract_key_verbs(text: str, n: int = 10) -> list:
    verb_pattern = r"\b(analyze|evaluate|measure|optimize|compare|reduce|apply|simulate|derive|validate|determine|identify|develop|create|build|define|use|make|get|take|find|show|provide|include|require|support|allow|enable|improve|increase|reduce|ensure|maintain|consider|achieve|perform|implement|design|test|verify|assess|review)\b"
    verbs = re.findall(verb_pattern, text, re.IGNORECASE)
    return [v for v,_ in Counter(v.lower() for v in verbs).most_common(n)]

def detect_dominant_sequence(sig_dist: dict) -> str:
    sig_seq_map = {
        "SIG_D": "SEQ_A", "SIG_Q": "SEQ_B", "SIG_E": "SEQ_G",
        "SIG_C": "SEQ_D", "SIG_X": "SEQ_E", "SIG_F": "SEQ_F",
        "SIG_RQ":"SEQ_H",
    }
    dominant = max(sig_dist, key=sig_dist.get) if sig_dist else "SIG_D"
    return sig_seq_map.get(dominant, "SEQ_A")

# ─── GENERATE RECORD ─────────────────────────────────────────────────────────

def generate_id(doc_type: str) -> str:
    prefix = ID_PREFIXES.get(doc_type.lower(), "USR")
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    rand_suffix = hashlib.md5(os.urandom(8)).hexdigest()[:4].upper()
    return f"{prefix}-{date_str}-{rand_suffix}"

def build_record(
    filepath: str,
    doc_type: str,
    genre: str,
    subgenre: str = "",
    title: str = "",
    source: str = "",
    language: str = "en"
) -> dict:
    print(f"[+] Processing: {filepath}")
    text = extract_text_from_file(filepath)
    if not text.strip():
        print("[!] Empty text extracted.")
        return {}

    word_count = len(text.split())
    vowel_freq = analyze_vowels(text)
    consonant_freq = analyze_consonants(text)
    pmap, pdensity = analyze_punctuation(text)
    avg_sent_len, dominant_sig, sig_dist = analyze_sentences(text)
    tense_dist = infer_tense_distribution(text)
    shell, shell_conf = infer_shell(vowel_freq, consonant_freq, tense_dist)
    dominant_tool, tool_dist = infer_dominant_tool(consonant_freq, sig_dist, shell)
    buoyancy_state = infer_buoyancy_state(shell, dominant_tool)
    exp_layer = infer_expression_layer(sig_dist)
    primary_emotion, emotion_cat, emotion_dist = infer_emotion(shell, dominant_tool, exp_layer)
    exp_context = map_expression_context(exp_layer)
    dominant_seq = detect_dominant_sequence(sig_dist)

    doc_id = generate_id(doc_type)
    inferred_title = title or Path(filepath).stem.replace("_"," ").replace("-"," ").title()

    record = {
        "id": doc_id,
        "doc_type": doc_type.lower(),
        "genre": genre.lower(),
        "subgenre": subgenre.lower() if subgenre else "",
        "title": inferred_title,
        "source": source or str(filepath),
        "date_added": datetime.now(timezone.utc).isoformat(),
        "date_authored": None,
        "language": language,
        "word_count": word_count,
        "linguistic_profile": {
            "vowel_frequency": vowel_freq,
            "consonant_class_freq": consonant_freq,
            "punctuation_density": pdensity,
            "punctuation_map": pmap,
            "avg_sentence_length": avg_sent_len,
            "tense_distribution": tense_dist,
            "sentence_structure_dist": sig_dist,
            "dominant_sig": dominant_sig,
            "dominant_sequence": dominant_seq,
        },
        "brpn_profile": {
            "inferred_shell": shell,
            "shell_confidence": shell_conf,
            "dominant_tool": dominant_tool,
            "tool_distribution": tool_dist,
            "buoyancy_state": buoyancy_state,
            "expression_layer": exp_layer,
        },
        "emotion_profile": {
            "primary_emotion": primary_emotion,
            "emotion_category": emotion_cat,
            "emotion_distribution": emotion_dist,
            "expression_context": exp_context,
        },
        "content_summary": {
            "summary": text[:600].strip() + ("..." if len(text) > 600 else ""),
            "key_concepts": extract_key_concepts(text),
            "key_verbs": extract_key_verbs(text),
            "key_sequences": list(set([dominant_seq])),
        },
        "nlp_tags": {
            "genres": [genre.lower()] + ([subgenre.lower()] if subgenre else []),
            "emotions": [f"EMO_{primary_emotion.upper()}"],
            "tools": [dominant_tool],
            "shells": [f"SHELL_{shell[:3]}"],
            "sequences": [dominant_seq],
            "sigs": list(sig_dist.keys()),
        },
    }
    return record

# ─── BATCH PROCESSING ────────────────────────────────────────────────────────

def batch_process(input_dir: str, output_dir: str, doc_type: str = "user_upload", genre: str = "general"):
    os.makedirs(output_dir, exist_ok=True)
    supported = {".txt",".md",".html",".pdf",".epub",".json"}
    files = [f for f in Path(input_dir).iterdir() if f.suffix.lower() in supported]
    print(f"[+] Found {len(files)} files in {input_dir}")
    all_records = []
    for fp in files:
        try:
            record = build_record(str(fp), doc_type, genre)
            if record:
                outfile = Path(output_dir) / f"{record['id']}.json"
                with open(outfile, "w") as f:
                    json.dump(record, f, indent=2)
                all_records.append(record)
                print(f"    ✓ {record['id']} → {outfile}")
        except Exception as e:
            print(f"    ✗ {fp}: {e}")
    index_path = Path(output_dir) / "_index.json"
    with open(index_path, "w") as f:
        json.dump({
            "generated": datetime.now(timezone.utc).isoformat(),
            "count": len(all_records),
            "records": [{"id":r["id"],"title":r["title"],"genre":r["genre"],"shell":r["brpn_profile"]["inferred_shell"],"emotion":r["emotion_profile"]["primary_emotion"]} for r in all_records]
        }, f, indent=2)
    print(f"\n[✓] Processed {len(all_records)} records. Index saved to {index_path}")
    return all_records

# ─── CLI ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Autumn NLP Document Normalizer")
    parser.add_argument("--input",      help="Single file to process")
    parser.add_argument("--type",       default="user_upload", help="Document type (article|journal|book|blog|technical|educational|...)")
    parser.add_argument("--genre",      default="general",     help="Genre/subject tag")
    parser.add_argument("--subgenre",   default="",            help="Sub-genre tag")
    parser.add_argument("--title",      default="",            help="Override document title")
    parser.add_argument("--source",     default="",            help="Source/publication info")
    parser.add_argument("--language",   default="en",          help="ISO 639-1 language code")
    parser.add_argument("--output",     default=None,          help="Output JSON file path")
    parser.add_argument("--batch",      help="Directory to batch process")
    parser.add_argument("--output-dir", default="./nlp-records", help="Output directory for batch mode")
    args = parser.parse_args()

    if args.batch:
        batch_process(args.batch, args.output_dir, args.type, args.genre)
    elif args.input:
        record = build_record(args.input, args.type, args.genre, args.subgenre, args.title, args.source, args.language)
        if record:
            out_path = args.output or f"{record['id']}.json"
            with open(out_path, "w") as f:
                json.dump(record, f, indent=2)
            print(f"\n[✓] Record saved: {out_path}")
            print(f"    ID:      {record['id']}")
            print(f"    Shell:   {record['brpn_profile']['inferred_shell']} (confidence: {record['brpn_profile']['shell_confidence']})")
            print(f"    Tool:    {record['brpn_profile']['dominant_tool']}")
            print(f"    Emotion: {record['emotion_profile']['primary_emotion']} ({record['emotion_profile']['emotion_category']})")
            print(f"    Layer:   {record['brpn_profile']['expression_layer']}")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
