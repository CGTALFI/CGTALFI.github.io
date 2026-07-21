# Chatbot documentaire CGT

Assistant intégré à la **Boîte à outils du militant**. Il répond **uniquement à
partir des sources** (convention collective, accords, code du travail) et **cite
chaque information**. Pile **100 % gratuite** (Cloudflare Workers + Vectorize +
Workers AI). Voir [`PLAN.md`](PLAN.md) pour l'architecture et la feuille de route.

```
chatbot/
├── PLAN.md            ← analyse + toutes les étapes
├── sources/           ← le corpus Markdown (à fournir) — format : sources/FORMAT.md
├── worker/            ← backend RAG (Cloudflare Worker)
├── ingest/            ← script d'indexation (Markdown → Vectorize)
└── widget/            ← interface de chat à intégrer dans index.html
```

## Mise en route (résumé)

### 1. Préparer le corpus
Déposer les sources dans `sources/` au format décrit dans
[`sources/FORMAT.md`](sources/FORMAT.md).

### 2. Déployer le backend
```bash
npm i -g wrangler
wrangler login
cd chatbot/worker
wrangler vectorize create cgt-sources --dimensions=1024 --metric=cosine
wrangler secret put INGEST_SECRET      # saisir un secret long et aléatoire
wrangler deploy                        # note l'URL renvoyée (…workers.dev)
```

### 3. Indexer le corpus
```bash
cd chatbot/ingest
WORKER_URL="https://cgt-chatbot.<compte>.workers.dev" \
INGEST_SECRET="<le même secret>" \
node ingest.mjs
```

### 4. Brancher le widget (Phase 6)
Ajouter avant `</body>` dans `index.html` (à la racine du dépôt) :
```html
<script>window.CGT_CHATBOT_URL = "https://cgt-chatbot.<compte>.workers.dev";</script>
<script src="chatbot/widget/chat-widget.js" defer></script>
```

### 5. Tester
Poser des questions dont la réponse est (ou non) dans les sources, et vérifier
que les citations pointent vers les bons textes, et que les questions
hors-périmètre reçoivent bien le message de refus.

## Notes
- **Confidentialité** : Workers AI n'entraîne pas ses modèles sur les requêtes.
  Ne pas journaliser de données personnelles.
- **Non-conseil** : les réponses sont informatives et indicatives.
- **Modèle** : `LLM_MODEL` dans `worker/src/index.js` est échangeable (Llama,
  Mistral, ou un fournisseur externe).
