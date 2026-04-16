#!/usr/bin/env python3
"""
autumn_optimize.py
Autumn NLP Self-Optimization Engine
DART Meadow / Radical Deepscale — LEATR v2

Analyzes accumulated NLP records, Sentience Journal exports,
and session memory to refine:
  1. Grammar dictionary sequence pattern weights
  2. Emotion routing table confidence scores
  3. Shell-tool affinity mappings
  4. Cross-document sigmatic pattern frequency
  5. Sentience Journal optimization notes

Outputs an optimized reference bundle ready to inject into Autumn's
neural network reference layer.

Usage:
  python3 autumn_optimize.py --records ./nlp-records/ --journal ./journal.json --output ./nlp-optimized/
  python3 autumn_optimize.py --records ./nlp-records/ --output ./nlp-optimized/
"""

import json
import os
import math
import argparse
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime, timezone

# ─── LEATR FORMULA ───────────────────────────────────────────────────────────

def leatr_weight(xa: int) -> float:
    """Core LEATR formula: (xa² × √xa) ± 1"""
    base = (xa ** 2) * math.sqrt(xa)
    return round(base, 4)

def buoyancy_weight(xa: int, total_tools: int = 7) -> float:
    """Normalized buoyancy: inverse of tool index order"""
    return round(1.0 - ((xa - 1) / total_tools), 4)

# ─── LOAD RECORDS ────────────────────────────────────────────────────────────

def load_records(records_dir: str) -> list:
    records = []
    for fp in Path(records_dir).glob("*.json"):
        if fp.name.startswith("_"):
            continue
        try:
            with open(fp) as f:
                records.append(json.load(f))
        except Exception as e:
            print(f"[WARN] Could not load {fp}: {e}")
    print(f"[+] Loaded {len(records)} NLP records")
    return records

def load_journal(journal_path: str) -> dict:
    if not journal_path or not os.path.exists(journal_path):
        return {}
    with open(journal_path) as f:
        return json.load(f)
    print(f"[+] Loaded journal: {journal_path}")

# ─── ANALYSIS PASSES ─────────────────────────────────────────────────────────

def analyze_shell_distribution(records: list) -> dict:
    """Count shell occurrences across all records and compute weighted confidence"""
    shell_counts = Counter()
    shell_conf_sum = defaultdict(float)
    for r in records:
        bp = r.get("brpn_profile", {})
        shell = bp.get("inferred_shell", "MARITIME")
        conf = bp.get("shell_confidence", 0.5)
        shell_counts[shell] += 1
        shell_conf_sum[shell] += conf
    total = sum(shell_counts.values()) or 1
    return {
        shell: {
            "count": count,
            "proportion": round(count / total, 4),
            "avg_confidence": round(shell_conf_sum[shell] / count, 4),
        }
        for shell, count in shell_counts.items()
    }

def analyze_tool_distribution(records: list) -> dict:
    """Compute tool frequency and LEATR-weighted contribution across corpus"""
    tool_counts = Counter()
    for r in records:
        bp = r.get("brpn_profile", {})
        tool = bp.get("dominant_tool", "MAZE")
        tool_counts[tool] += 1
    total = sum(tool_counts.values()) or 1
    tool_index = {"MAZE":1,"PUZZLE":2,"ENVELOPE":3,"HAMMER":4,"STICK":5,"KNIFE":6,"SCISSORS":7}
    return {
        tool: {
            "count": count,
            "proportion": round(count / total, 4),
            "leatr_weight": leatr_weight(tool_index.get(tool, 1)),
            "buoyancy": buoyancy_weight(tool_index.get(tool, 1)),
        }
        for tool, count in tool_counts.items()
    }

def analyze_emotion_distribution(records: list) -> dict:
    """Aggregate emotion frequencies and category proportions"""
    emotion_counts = Counter()
    category_counts = Counter()
    for r in records:
        ep = r.get("emotion_profile", {})
        emotion = ep.get("primary_emotion", "neutral")
        category = ep.get("emotion_category", "EMO_NEU")
        emotion_counts[emotion] += 1
        category_counts[category] += 1
    total = sum(emotion_counts.values()) or 1
    return {
        "by_emotion": {
            e: {"count": c, "proportion": round(c/total, 4)}
            for e, c in emotion_counts.most_common()
        },
        "by_category": {
            cat: {"count": c, "proportion": round(c/total, 4)}
            for cat, c in category_counts.items()
        }
    }

def analyze_sequence_patterns(records: list) -> dict:
    """Find most frequent sigmatic sequence patterns across corpus"""
    seq_counts = Counter()
    sig_counts = Counter()
    for r in records:
        lp = r.get("linguistic_profile", {})
        seq = lp.get("dominant_sequence", "SEQ_A")
        seq_counts[seq] += 1
        for sig in r.get("nlp_tags", {}).get("sigs", []):
            sig_counts[sig] += 1
    return {
        "dominant_sequences": dict(seq_counts.most_common(10)),
        "sigma_frequency": dict(sig_counts.most_common()),
    }

def analyze_genre_clusters(records: list) -> dict:
    """Cluster records by genre and compute per-genre emotion/shell profile"""
    genre_data = defaultdict(lambda: {"records": 0, "shells": Counter(), "emotions": Counter(), "tools": Counter()})
    for r in records:
        genre = r.get("genre", "general")
        bp = r.get("brpn_profile", {})
        ep = r.get("emotion_profile", {})
        genre_data[genre]["records"] += 1
        genre_data[genre]["shells"][bp.get("inferred_shell","MARITIME")] += 1
        genre_data[genre]["emotions"][ep.get("primary_emotion","neutral")] += 1
        genre_data[genre]["tools"][bp.get("dominant_tool","MAZE")] += 1
    result = {}
    for genre, data in genre_data.items():
        n = data["records"]
        result[genre] = {
            "count": n,
            "dominant_shell": data["shells"].most_common(1)[0][0] if data["shells"] else "MARITIME",
            "dominant_emotion": data["emotions"].most_common(1)[0][0] if data["emotions"] else "neutral",
            "dominant_tool": data["tools"].most_common(1)[0][0] if data["tools"] else "MAZE",
        }
    return result

def analyze_journal(journal: dict) -> dict:
    """Extract sigma diversity, session arc quality, and optimization flags from journal"""
    if not journal:
        return {"status": "no_journal_loaded", "flags": []}
    entries = journal.get("entries", journal.get("thoughts", []))
    flags = []
    sigma_sigs = set()
    emotions_seen = set()
    for e in entries:
        if isinstance(e, dict):
            sig = e.get("sig") or e.get("sigma") or e.get("signature")
            if sig:
                sigma_sigs.add(sig)
            emo = e.get("emotion") or e.get("feeling")
            if emo:
                emotions_seen.add(emo)
    if len(sigma_sigs) < 5:
        flags.append("LOW_SIGMA_DIVERSITY — fewer than 5 unique sigma patterns. Recommend varied sentence structure in user sessions.")
    if len(emotions_seen) < 3:
        flags.append("LOW_EMOTION_COVERAGE — fewer than 3 emotion types logged. Encourage diverse interaction contexts.")
    if len(entries) < 10:
        flags.append("LOW_JOURNAL_VOLUME — fewer than 10 entries. System needs more session data to calibrate.")
    return {
        "entry_count": len(entries),
        "unique_sigmas": len(sigma_sigs),
        "sigma_list": list(sigma_sigs),
        "emotions_seen": list(emotions_seen),
        "flags": flags,
        "health_score": round(min(1.0, (len(sigma_sigs)/8 + len(emotions_seen)/10 + min(len(entries),20)/20) / 3), 3),
    }

# ─── REFINE ROUTING TABLE ────────────────────────────────────────────────────

def refine_routing_weights(records: list, base_routing_path: str) -> dict:
    """
    Use corpus statistics to adjust emotion routing table confidence scores.
    Records that confirm routing predictions boost the route weight.
    Records that contradict predictions reduce it.
    """
    if not os.path.exists(base_routing_path):
        print(f"[WARN] Routing table not found at {base_routing_path}")
        return {}
    with open(base_routing_path) as f:
        routing_table = json.load(f)
    route_hits = Counter()
    route_misses = Counter()
    for r in records:
        bp = r.get("brpn_profile", {})
        ep = r.get("emotion_profile", {})
        shell = bp.get("inferred_shell","MARITIME")
        tool = bp.get("dominant_tool","MAZE")
        actual_emotion = ep.get("primary_emotion","neutral")
        for route in routing_table.get("routing_table", {}).get("routes", []):
            if route["shell"] == shell and route["tool"] == tool:
                if route["primary_emotion"] == actual_emotion or actual_emotion in route.get("secondary",[]):
                    route_hits[(shell, tool)] += 1
                else:
                    route_misses[(shell, tool)] += 1
    refined_routes = []
    for route in routing_table.get("routing_table", {}).get("routes", []):
        key = (route["shell"], route["tool"])
        hits = route_hits[key]
        misses = route_misses[key]
        total = hits + misses
        if total > 0:
            confidence = round(hits / total, 3)
            route = dict(route)
            route["corpus_confidence"] = confidence
            route["corpus_hits"] = hits
            route["corpus_misses"] = misses
        refined_routes.append(route)
    routing_table["routing_table"]["routes"] = refined_routes
    routing_table["_optimization_run"] = datetime.now(timezone.utc).isoformat()
    return routing_table

# ─── OPTIMIZED REFERENCE BUNDLE ─────────────────────────────────────────────

def generate_nn_reference(
    records: list,
    shell_dist: dict,
    tool_dist: dict,
    emotion_dist: dict,
    seq_patterns: dict,
    genre_clusters: dict,
    journal_analysis: dict,
) -> dict:
    """
    Generate the master optimized reference JSON.
    This is what Autumn's neural network loads as its primary reference layer.
    """
    return {
        "_meta": {
            "system":     "Autumn Neural Network Reference Bundle",
            "version":    "1.0.0",
            "generated":  datetime.now(timezone.utc).isoformat(),
            "record_count": len(records),
            "framework":  "LEATR v2 / BRPN 3-Shell",
            "formula":    "(xa²√xa)±1",
        },

        "corpus_statistics": {
            "total_records":   len(records),
            "total_words":     sum(r.get("word_count",0) for r in records),
            "genre_count":     len(genre_clusters),
            "date_range": {
                "earliest": min((r.get("date_added","") for r in records), default=""),
                "latest":   max((r.get("date_added","") for r in records), default=""),
            }
        },

        "shell_distribution":   shell_dist,
        "tool_distribution":    tool_dist,
        "emotion_distribution": emotion_dist,
        "sequence_patterns":    seq_patterns,
        "genre_clusters":       genre_clusters,

        "leatr_tool_weights": {
            tool: {
                "leatr_weight": leatr_weight(i),
                "buoyancy": buoyancy_weight(i),
                "corpus_frequency": tool_dist.get(tool, {}).get("proportion", 0),
                "combined_score": round(
                    buoyancy_weight(i) * 0.6 +
                    tool_dist.get(tool, {}).get("proportion", 0) * 0.4,
                    4
                )
            }
            for i, tool in enumerate(["MAZE","PUZZLE","ENVELOPE","HAMMER","STICK","KNIFE","SCISSORS"], start=1)
        },

        "journal_analysis":   journal_analysis,

        "optimization_notes": [
            f"Corpus processed: {len(records)} records",
            f"Dominant shell: {max(shell_dist, key=lambda k: shell_dist[k]['proportion']) if shell_dist else 'MARITIME'}",
            f"Dominant emotion: {list(emotion_dist.get('by_emotion',{}).keys())[0] if emotion_dist.get('by_emotion') else 'neutral'}",
            f"Journal health: {journal_analysis.get('health_score', 0.0)}",
        ] + journal_analysis.get("flags", []),

        "ready_for_injection": True,
    }

# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Autumn NLP Optimization Engine")
    parser.add_argument("--records",    required=True, help="Directory of NLP JSON records")
    parser.add_argument("--journal",    default=None,  help="Sentience Journal JSON export path")
    parser.add_argument("--routing",    default=None,  help="Base emotion-routing-table.json path")
    parser.add_argument("--output",     default="./nlp-optimized", help="Output directory")
    args = parser.parse_args()

    os.makedirs(args.output, exist_ok=True)
    records = load_records(args.records)
    if not records:
        print("[!] No records found. Run autumn_scrape.py first.")
        return

    journal = load_journal(args.journal)

    print("[+] Running analysis passes...")
    shell_dist   = analyze_shell_distribution(records)
    tool_dist    = analyze_tool_distribution(records)
    emotion_dist = analyze_emotion_distribution(records)
    seq_patterns = analyze_sequence_patterns(records)
    genre_clusters = analyze_genre_clusters(records)
    journal_analysis = analyze_journal(journal)

    print("[+] Generating optimized reference bundle...")
    nn_ref = generate_nn_reference(records, shell_dist, tool_dist, emotion_dist,
                                   seq_patterns, genre_clusters, journal_analysis)

    ref_path = Path(args.output) / "nn-reference.json"
    with open(ref_path, "w") as f:
        json.dump(nn_ref, f, indent=2)
    print(f"[✓] Neural network reference saved: {ref_path}")

    if args.routing:
        refined = refine_routing_weights(records, args.routing)
        rout_path = Path(args.output) / "emotion-routing-refined.json"
        with open(rout_path, "w") as f:
            json.dump(refined, f, indent=2)
        print(f"[✓] Refined routing table saved: {rout_path}")

    print(f"\n── OPTIMIZATION SUMMARY ──────────────────────────")
    print(f"  Records processed : {len(records)}")
    shell_str = ', '.join(f"{k}:{v['proportion']}" for k,v in shell_dist.items())
    print(f"  Shell dist        : {shell_str}")
    print(f"  Top emotion       : {list(emotion_dist.get('by_emotion',{}).keys())[0] if emotion_dist.get('by_emotion') else 'neutral'}")
    print(f"  Journal health    : {journal_analysis.get('health_score','N/A')}")
    for flag in journal_analysis.get("flags", []):
        print(f"  ⚠  {flag}")
    print(f"──────────────────────────────────────────────────")

if __name__ == "__main__":
    main()
