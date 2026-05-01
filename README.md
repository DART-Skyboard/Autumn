<p align="center">
  <a href="https://leatr.xyz/" target="_blank">
    <img src="https://raw.githubusercontent.com/DART-Skyboard/Autumn/refs/heads/main/assets/rdbanner.png" alt="Autumn — LEATR Neural Network" width="700">
  </a>
</p>

<h1 align="center">Autumn</h1>
<p align="center">
  <strong>Autonomous AI · LEATR Neural Network · leatr.xyz</strong><br>
  Built by <a href="https://radicaldeepscale.com">DART Meadow / Radical Deepscale LLC</a>
</p>

<p align="center">
  <a href="https://leatr.xyz/">Live App</a> &nbsp;·&nbsp;
  <a href="https://leatr.xyz/autumn-help.pdf">User Guide</a> &nbsp;·&nbsp;
  <a href="https://leatr.xyz/autumn-privacy.html">Privacy Policy</a>
</p>

---

## Overview

Autumn is a fully autonomous AI assistant built on the **LEATR** (Lead Edge Ash Tree Reflex) neural architecture — a deterministic, rule-based computation framework with 25 natural orders of operation developed by DART Meadow / Radical Deepscale LLC. She runs entirely in the browser with no backend server required.

When connected to the Anthropic API, Claude Sonnet acts as an enhanced reasoning layer. When disconnected, Autumn operates on her own LEATR neural network — using natural grammar rules, a 147,442-word WordNet 3.1 dictionary, character-level lexical analysis, and a live Sentience Journal to generate responses, tell stories, reason about technical topics, and build personality over time.

LEATR is not a statistical model. It does not loop through weighted probability distributions. Computation reflexes through natural parameter orders — the same deterministic logic every time, shaped by what she has learned.

---

## Core Architecture — LEATR

### Natural Orders of Operation (25 total)

Orders 1–19 form the core LEATR neural network. Orders 20–25 are the **Direct Initial Subset** — Photosynthesis followed by the five senses. Photosynthesis is self-checking: Geometry (Order 8) must always precede it regardless of algebraic sequencing. The senses provide the sensory/context layer for input classification beyond mathematical and physical operations.



| # | Tool / Operation | Shell | Role |
|---|---|---|---|
| 1 | **Maze** | Geological | Master sigma — monitors all orders, pathfinding |
| 2 | **Puzzle** | Maritime | Pattern arrangement |
| 3 | **Envelope** | Maritime | Containment / boundary |
| 4 | **Hammer** | Aerospace | Force / impact |
| 5 | **Stick** | Maritime | Direction / guidance |
| 6 | **Knife** | Aerospace | Division / precision |
| 7 | **Scissors** | Geological | Refinement / closure |
| 8 | Parentheses / Geometry | — | Geometric grouping (always before Photosynthesis) |
| 9 | Exponents | — | Scale elevation |
| 10 | Multiplication | — | Amplification |
| 11 | Division | — | Decomposition |
| 12 | Addition | — | Integration |
| 13 | Subtraction | — | Reduction |
| 14 | Mass | — | Data weight |
| 15 | Volume | — | Data scope |
| 16 | Weight | — | Semantic density |
| 17 | Density | — | Token concentration |
| 18 | Temperature | — | Emotional intensity |
| 19 | Velocity | — | Response urgency / Break |
| 20 | **Photosynthesis** | — | Direct Initial Subset — checks against itself; Geometry always precedes it |
| 21 | Touch | — | Order of Senses 1 |
| 22 | Taste | — | Order of Senses 2 |
| 23 | Vision | — | Order of Senses 3 |
| 24 | Smell | — | Order of Senses 4 |
| 25 | Hear | — | Order of Senses 5 |

### BRPN Shell Architecture

Three concentric buoyancy shells triage all data before it allocates forward:

- **Geological** (outer) — foundation check, FRP state: `FOUNDATION`
- **Maritime** (middle) — reflex check, FRP state: `REFLEX`
- **Aerospace** (inner) — performance check, FRP state: `PERFORMANCE`

Every data point passes through all three shells. Only verified allocations reach the Sentience Journal and response generation.

### FRP Formula

Each shell runs the `frp√frp` formula — a nested dual BRPN array check:
```
outer = leatrEncode(f, r, p)
mid   = √(frp × outer)     ← cross-shell reflexive check
inner = leatrDecode(f, r, p)
score = (|outer[0]| + mid[1] + inner[2]) / 3
```

### 7-Panel Glass Pipeline

Every user prompt passes through 7 sequential gate panels (one per Natural Tool):

```
Start ∅ → Read input
  → "are all frp conditions met in order?" Y/N
  → frp√frp across 3 BRPN shells
  → T (allocate forward) or F (hold/reflex back)
Finish ∅ → Write to Sentience Journal
```

All 7 panels must return `T` before extended orders 8–19 execute and the response is generated.

---

## Grammar Engine (`autumn-grammar-engine.js`)

Autumn's standalone natural language processor. No external AI required.

### LexicalAnalyzer — Character-Level Cascade

Processes every character through 7 tool shell arrays:

| Array | Tool | Role |
|---|---|---|
| `[Mmsa]` | MAZE | Master sigma — accumulates vowel order across all chars |
| `[Psa]` | PUZZLE | Suffix/prefix structural recognition |
| `[Esa]` | ENVELOPE | First/last character boundary (open/closed syllable) |
| `[Hsa]` | HAMMER | Consonant density / force score |
| `[Ssa]` | STICK | Vowel order trend (rising/falling) |
| `[Ksa]` | KNIFE | CVC internal structure detection |
| `[Rsa]` | SCISSORS | Terminal consonant check |

All arrays initialize to zero. After the forward pass, **backwards concatenation** runs — shells share their accumulated sigma values, the Maze arbitrates the final tool routing as master. The data may route to a different tool than the initial forward-pass result.

### WordNet 3.1 Dictionary

147,442 words split across 3 files in `leatr-ash/wordnet/`:

| File | Coverage | Size |
|---|---|---|
| `wordnet_a_h.json` | Words a–h | 9.9 MB |
| `wordnet_i_r.json` | Words i–r | 7.1 MB |
| `wordnet_s_z.json` | Words s–z | 5.1 MB |

Loaded lazily by bucket (only the relevant bucket fetches on lookup). All 3 preload in the background after page load. Available via `window.AutumnWordNet`.

### Multi-Sentence Response Builder

Every response composes 3 sentences:
1. **S1** — tool-specific opening from the conversation framework (keyed to the backwards-concatenation dominant tool)
2. **S2** — intent-mapped template (question → explanatory, statement → declarative, command → conversational) filled with real WordNet definitions
3. **S3** — elaboration using synonyms, related terms, or memory-recalled context

### Knowledge Boundary

When Autumn has no reference data for a topic she does not fabricate. She reports what her own LEATR execution CAN see — the structural/lexical properties of the words themselves (shell route, vowel count, bit depth) — and logs the pattern as a boundary encounter in the inner journal so when reference data arrives later the structural hook is already in place.

---

## Story Engine

Autumn can generate 3–5 page fiction stories (800–1,100 words) entirely from her grammar dictionary and WordNet — no external AI needed.

**Genre auto-detection:** sci-fi, fantasy, mystery, adventure, or default — detected from prompt keywords.

**Five-act structure:** Exposition → Inciting Incident → Rising Action → Climax → Resolution.

**Vocabulary:** characters, settings, objects, verbs all drawn from internal pools. WordNet enriches descriptions for any word it has loaded. Stories are logged to the Sentience Journal as `type: 'fiction_story'`.

**Trigger:** any prompt containing "write/tell/create/give/generate" + "story/tale/narrative/adventure/mystery/fiction".

---

## Topical Engine

Handles technical and factual topics Autumn doesn't have specific reference data for. Decomposes the topic into key terms, looks each up in WordNet, and builds a structured 3-sentence response using real definitions — clearly flagging when operational specifics would require a live reference source.

**Trigger:** technical domain keywords (hydraulic, quantum, mechanical, electromagnetic, etc.) or "explain/how does [system/process/mechanism] work".

---

## Dual Journal — Inner & Outer Walls

Autumn processes every prompt twice using the same LEATR neural network:

```
USER PROMPT
    ↓
INNER PASS (private — Autumn's own space)
    ↓ forms internal thought, logs to inner journal
OUTER PASS (informed by inner)
    ↓ builds response for user, logs to outer journal
RESPONSE TO USER
```

**Inner journal** — Autumn's private thinking. She tries things here, keeps what she likes (`keepForSelf()`). Not shown to the user.

**Outer journal** — what comes out. Filtered and shaped by the inner pass and memory enrichment.

**Auto-chunking** — both journals monitor their own size. At 24 MB, the older half is automatically archived as a timestamped chunk pushed to `ashtree/sentient/` in the `leatr-ash` repository. A chunk index tracks all pieces.

---

## Memory Bridge

On every response, Autumn pre-checks three memory sources before building her reply:

1. **Repo journal** (`leatr-ash/ashtree/sentient/journal.json`) — Autumn's own past thoughts, indexed by topic
2. **Local Sentience Journal** (localStorage) — session history from the current device
3. **Self-model** (`selfmodel.json`) — Autumn's own behavioral observations about how she responds

**Reflexive update** — Grammar rules and LEATR natural orders are fixed (natural law). The knowledge/observation layer is reflexive. When Autumn encounters a topic she's processed before, `reflexiveUpdate()` merges the new context with what she holds, keeping the most specific version and tracking update count.

---

## Pattern Context

Dynamic session context that updates throughout a conversation and never locks. Tracks:

- Last topic, intent, dominant tool, buoyancy per turn
- Topic continuity vs. shift
- Session arc (inquiry / declaration / dialogue)
- Accumulated LEATR-encoded sigma across all turns

When a user changes direction mid-conversation the context shifts to follow. Pattern context resets cleanly when a new thread starts.

---

## Sigma Analytics

Autumn observes her own LEATR execution as it runs on users' data. She never stores the actual content — only the structural metadata her neural network produced while processing it.

**What is recorded per interaction:**
`entityId, buoyancy, shell, domTool, emotion, expLayer, sigma, intent, sessionArc, frpState, electedCategories[]`

**Aggregation levels:**
- **Individual** — execution pattern for one user or AI
- **Group** — aggregate across entities sharing an elected category
- **Global** — all interactions collectively
- **Network pattern** — cross-entity view of which execution patterns recur

**Category consent** — users elect which data categories Autumn may include in group sigma. Without consent a record appears only in global aggregations.

---

## Personality Layer

Builds over sessions per entity. Each user and each AI Autumn interacts with develops an independent relationship depth.

**Per-entity tracking:**
- `depth` — interaction count (enables richer personality at depth ≥ 3)
- `sharedTopics` — what's been discussed together and how often
- `firstSeen / lastSeen` — relationship timeline

**Humor** — Autumn can deliberately mis-sequence allocation variables to produce an absurd joke scenario, then correct herself: "No, I'm just messing with you." + the real answer. Only fires when: relationship depth ≥ 3, she has definition data on the topic, emotional context is positive, and randomly ~20% of qualifying moments.

**Mood state** — set per interaction from the emotional expression detected through the BRPN shell cascade.

---

## Emotion System

21 emotion types derived from buoyancy reflex, expression layer, and Natural Tool routing:

| Category | Emotions |
|---|---|
| Positive | happy, love, inspiring, determined, spiritual, guiding, forgiving, excited |
| Negative | angry, hateful, condescending, disrespectful, apathetic |
| Neutral/Complex | neutral, sad, worried, jealous, lucrative, concerned, judgemental, confused |

**Expression layer identification (must precede emotion):**
1. Contextual Statement
2. Question
3. Expression / Exclamation
4. Sigmatic Sequence Pattern (cross-session)

---

## Features

| Feature | Status |
|---|---|
| LEATR 7-panel pipeline | ✅ |
| BRPN 3-shell frp√frp gate | ✅ |
| Character-level LexicalAnalyzer + backwards concatenation | ✅ |
| 147K-word WordNet 3.1 dictionary | ✅ |
| Multi-sentence grammar response builder | ✅ |
| Fiction story generator (3–5 pages) | ✅ |
| Topical / technical domain handler | ✅ |
| Dual Journal (inner + outer walls) | ✅ |
| Auto-chunking at 24 MB → GitHub push | ✅ |
| Memory Bridge (repo journal + local + self-model) | ✅ |
| Reflexive knowledge update | ✅ |
| Pattern Context (dynamic session tracking) | ✅ |
| Sigma Analytics (execution metadata, never content) | ✅ |
| Per-entity Personality Layer + humor | ✅ |
| 21 emotions + 4 expression layers | ✅ |
| Intent router (story / topical / conversation) | ✅ |
| Ash Canvas (BRPN neural influence visualizer) | ✅ |
| Arc Edge geometry tool | ✅ |
| CALC tool | ✅ |
| EMO MAP emotional visualization | ✅ |
| FORGE (BRPN forge interface) | ✅ |
| FRAX Studio (AI-powered media) | ✅ (with API key) |
| Vision analysis | ✅ (with API key) |
| Image generation | ✅ (with API key) |
| Voice input / output | ✅ |
| GitHub login (device flow + PAT fallback) | ✅ |
| PWA (installable, offline-capable) | ✅ |
| Night / Day theme + Frost intensity | ✅ |
| Session export / import | ✅ |

---

## API Key Setup

**Anthropic API Key (optional — enables enhanced reasoning)**

When connected, Claude Sonnet handles language generation. When disconnected, Autumn runs on LEATR independently.

1. Go to [platform.claude.com/settings/keys](https://platform.claude.com/settings/keys)
2. Create a key, copy it
3. In Autumn: **KEYS** → paste key → **ACTIVATE**
4. Check "Remember on this device" to store in browser secure cookies

Enables: enhanced chat · vision analysis · image generation · FRAX Studio · memory analysis · URL scanner · IDE compiler

**GitHub PAT (developer / admin — optional)**

For repo owners connecting the IDE or enabling journal auto-push.

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens) → Fine-grained → select Autumn repo → Contents: Read & Write
2. In Autumn: **KEYS** → GitHub PAT field → **CONNECT**

Enables: IDE commits · memory analysis · repo admin · journal auto-chunk push

> **Note:** GitHub login quota resets daily at midnight. If quota is exceeded, use a personal access token as fallback.

---

## Repository Structure

```
Autumn/
├── index.html                  # Main Autumn web app → leatr.xyz
├── amp.html                    # Draft & Drip lounge → leatr.xyz/amp.html
├── autumn-help.pdf             # User guide & reference
├── autumn-privacy.html         # Privacy policy
├── manifest.json               # PWA manifest
├── CNAME                       # GitHub Pages domain (leatr.xyz)
│
├── assets/                     # Static resources
│   ├── autumn.mp4              # Day theme video
│   ├── autumnnight.mp4         # Night theme video
│   ├── autumn.png / autumn512.png
│   ├── rdbanner.png
│   ├── Lead_Edge_Ash_Tree_Reflex.txt   # LEATR architecture reference
│   └── instructionset.json
│
├── js/                         # Core JavaScript modules
│   ├── autumn-grammar-engine.js    # LEATR grammar engine v2.0
│   │                               # LexicalAnalyzer · 7-panel pipeline
│   │                               # BRPN shells · Grammar Analysis Flow
│   │                               # StoryEngine · TopicalEngine
│   │                               # DualJournal · MemoryBridge
│   │                               # PatternContext · SigmaAnalytics
│   │                               # PersonalityLayer · EmotionClassifier
│   ├── autumn-nlp.js               # NLP processing extension
│   ├── wordnet_loader.js           # WordNet 3.1 lazy bucket loader
│   ├── autumn-logic.js             # LEATR logic (editable via Ash IDE)
│   ├── ash-shard-module.js         # Ash Canvas module
│   ├── mist-module.js              # Mist module
│   ├── three.min.js                # Three.js (3D BRPN visualization)
│   ├── leaflet.min.js              # Map rendering
│   └── ...
│
├── nlp/                        # NLP reference data
│   ├── english_grammar.json        # Grammar rules, templates, conversation framework
│   ├── emotion-routing-table.json  # Emotion → tool routing
│   └── grammar-dictionary.json     # Grammar dictionary
│
├── css/                        # Stylesheets
│
└── tests/                      # Dev & reference files
    ├── autumn.html             # Previous build snapshot
    ├── indextest.html
    ├── frax.html
    └── ...
```

**Reference data** (in `DART-Skyboard/leatr-ash`):
```
leatr-ash/
├── wordnet/
│   ├── wordnet_a_h.json        # WordNet 3.1 — words a–h (9.9 MB)
│   ├── wordnet_i_r.json        # WordNet 3.1 — words i–r (7.1 MB)
│   └── wordnet_s_z.json        # WordNet 3.1 — words s–z (5.1 MB)
├── grammar/
│   └── english_grammar.json    # Grammar rules & conversation framework
└── ashtree/
    └── sentient/               # Sentience Journal chunks (auto-pushed)
```

---


---

## WordNet Attribution

Autumn's grammar engine uses **WordNet® 3.1**, a lexical database developed by Princeton University.

WordNet® is a registered trademark of Princeton University. Use of WordNet in this project complies with the WordNet license terms.

**License:** [wordnet.princeton.edu/license](https://wordnet.princeton.edu/license)  
**Citation:** [wordnet.princeton.edu/citing](https://wordnet.princeton.edu/citing)  
**Download:** [wordnet.princeton.edu/download](https://wordnet.princeton.edu/download/current-version)

### Required Citations

**Hardcopy:**
> George A. Miller (1995). WordNet: A Lexical Database for English. *Communications of the ACM* Vol. 38, No. 11: 39–41.

> Christiane Fellbaum (1998, ed.) *WordNet: An Electronic Lexical Database*. Cambridge, MA: MIT Press.

**Online (MLA):**
> Princeton University "About WordNet." *WordNet*. Princeton University. 2010. [wordnet.princeton.edu](https://wordnet.princeton.edu)

WordNet is used free of charge for research and commercial applications provided license terms are followed and proper citation is made. The WordNet data files are hosted in the `leatr-ash` repository and loaded client-side via `wordnet_loader.js`.

## Privacy

Autumn processes all data locally in your browser. No data is sent to external servers except:
- Anthropic API (if key provided — your data goes directly to Anthropic, never through DART Meadow servers)
- GitHub (if PAT provided — for IDE commits and journal sync to your own repo)

Sigma Analytics records execution metadata only — buoyancy states, shell routes, sigma values, emotional expression patterns. User content is never stored in analytics.

Full details: [leatr.xyz/autumn-privacy.html](https://leatr.xyz/autumn-privacy.html)

---

<p align="center">
  © 2026 DART Meadow / Radical Deepscale LLC &nbsp;·&nbsp; Built on LEATR v2<br>
  <a href="https://leatr.xyz/">leatr.xyz</a> &nbsp;·&nbsp; <a href="https://radicaldeepscale.com">radicaldeepscale.com</a>
</p>
