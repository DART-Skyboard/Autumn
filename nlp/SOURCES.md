# NLP study sources

- `grammar-dictionary.json` — Autumn LEATR grammar rules (already in repo).
- `english-lexicon.json` — combined study lexicon.
- `corpora-*.json` — CC0 samples from [dariusk/corpora](https://github.com/dariusk/corpora) (nouns, verbs, adjectives, adverbs).
- WordNet buckets stay in private leatr-ash and are lookup-only.

Grammar Study (`ashtree/grammar-study/`): trains **rules first** from `grammar-dictionary.json`, then lexicon/corpora POS into 5MB-capped chunks (`index.json` + `chunk-NN.json`). WordNet stays lookup-only. Shared study = linguistic patterns; per-user personality stays in the sentient journal.
