# Chatbot documentaire CGT — Plan complet

Assistant intégré à la **Boîte à outils du militant**, destiné **exclusivement**
à fournir des informations **précises et sourcées** à partir de trois corpus :

- la **convention collective** applicable ;
- les **accords** (entreprise, groupe, branche) ;
- le **code du travail** (articles pertinents).

> Principe directeur : **le chatbot ne « sait » rien par lui-même.** Il répond
> uniquement à partir des extraits retrouvés dans les sources et **cite chaque
> information** (titre + référence d'article + lien), sous forme de points
> Markdown. S'il ne trouve pas, il le dit et n'invente rien.

---

## 1. Contrainte d'architecture

Le site est **statique** (GitHub Pages). Un chatbot fiable a besoin de deux
choses qui ne peuvent pas vivre dans une page publique :

1. un **appel modèle IA** — la clé/API ne doit jamais être exposée côté client ;
2. une **recherche documentaire** (retrieval) sur les sources.

D'où l'architecture retenue :

```
 index.html (widget de chat)
        │  POST /chat  { question }
        ▼
 Cloudflare Worker (backend serverless, gratuit)
        ├─ 1. embedding de la question      → Workers AI  (@cf/baai/bge-m3)
        ├─ 2. recherche des extraits         → Vectorize  (base vectorielle)
        ├─ 3. prompt strict + extraits       → Workers AI  (LLM Llama/Mistral)
        └─ 4. réponse + sources (Markdown)   → renvoyées au widget
```

**Pile 100 % gratuite (offre free Cloudflare)** — aucun serveur à maintenir,
clé API secrète côté Worker, pas d'entraînement sur les données :

| Brique | Service | Rôle | Coût |
|--------|---------|------|------|
| Backend | Cloudflare **Workers** | proxy + logique RAG | gratuit (100k req/j) |
| Recherche | Cloudflare **Vectorize** | base vectorielle des extraits | gratuit (offre free) |
| Embeddings | **Workers AI** `@cf/baai/bge-m3` | vectorise texte FR/multilingue | gratuit (quota/j) |
| Modèle | **Workers AI** (Llama 3.3 / Mistral) | rédige la réponse sourcée | gratuit (quota/j) |
| Front | **GitHub Pages** (existant) | app + widget | gratuit |

> Le modèle est un **paramètre** (`LLM_MODEL`) : on peut passer à Mistral, à un
> modèle plus gros, ou à un fournisseur externe (Gemini/Groq/Claude) sans
> retoucher l'architecture. Alternatives gratuites notées en Annexe A.

---

## 2. Anti-hallucination & citation (exigence n°1)

Mécanismes cumulés qui garantissent « info précise + source » :

1. **RAG strict** : le modèle ne reçoit que les extraits retrouvés ; consigne
   système = *« réponds UNIQUEMENT à partir des extraits, sinon dis que tu ne
   sais pas »*.
2. **Seuil de pertinence** (`MIN_SCORE`) : si aucun extrait n'est assez proche,
   le backend **refuse** avant même d'appeler le modèle (message de repli).
3. **Citations obligatoires** : chaque extrait est numéroté `[n]` ; la réponse
   référence ces numéros, et le widget affiche la **liste des sources en points
   Markdown** avec lien cliquable vers le texte d'origine.
4. **Vérifiabilité** : l'extrait exact retrouvé est affiché sous la réponse, pour
   que le militant contrôle la source lui-même.
5. **Température basse** (0.1) : réponses factuelles, peu « créatives ».
6. **Mention légale** : réponses *informatives et indicatives*, ne remplacent pas
   l'avis d'un·e délégué·e / d'un·e juriste.

---

## 3. Feuille de route — les étapes

### Phase 0 — Cadrage & conformité
- [ ] Définir le périmètre exact des sources (quelle convention, quels accords).
- [ ] RGPD : pas de collecte de données personnelles dans les questions ; logs
      anonymisés ; mention légale + politique de confidentialité.
- [ ] Rédiger le disclaimer « non-conseil juridique ».

### Phase 1 — Corpus (⚠️ action utilisateur)
- [ ] Fournir les sources en **Markdown** au format défini
      dans [`sources/FORMAT.md`](sources/FORMAT.md).
- [ ] Convention collective → `sources/convention-collective.md`
- [ ] Accords → `sources/accords/*.md`
- [ ] Articles du code du travail → `sources/code-du-travail/*.md`
- [ ] Chaque bloc porte : titre, référence d'article, URL Légifrance, date de MAJ.

### Phase 2 — Indexation (RAG)
- [ ] `ingest/ingest.mjs` : découpe les Markdown en **chunks par article**,
      envoie au Worker `/admin/ingest` (protégé par secret).
- [ ] Le Worker calcule les embeddings et remplit **Vectorize**.
- [ ] Créer l'index Vectorize (dimensions **1024**, métrique **cosine**).

### Phase 3 — Backend (Worker)
- [ ] `worker/src/index.js` : endpoint `/chat` (embed → retrieve → prompt → LLM).
- [ ] Garde-fous : seuil de pertinence, refus hors-périmètre, CORS restreint,
      limite de longueur de question, (option) rate-limiting.

### Phase 4 — Modèle & prompt
- [ ] Prompt système anti-hallucination (voir `worker/src/index.js`).
- [ ] Format de citation Markdown ; température 0.1 ; `max_tokens` raisonnable.
- [ ] Choisir/geler le modèle (`LLM_MODEL`).

### Phase 5 — Widget d'interface
- [ ] `widget/chat-widget.js` : bulle de chat à la charte CGT (rouge #E30613),
      rendu Markdown, sources cliquables, états chargement / refus / erreur.

### Phase 6 — Intégration dans `index.html`
- [ ] Ajouter le widget à l'app **sans toucher au bundle** existant
      (une balise `<script defer>` avant `</body>`).
- [ ] Vérifier responsive / mobile / PWA.

### Phase 7 — Déploiement
- [ ] `wrangler deploy` du Worker ; `wrangler secret put INGEST_SECRET`.
- [ ] Créer l'index Vectorize ; router le Worker (ex. `api.cgt-alfi.fr` ou
      `*.workers.dev`).
- [ ] Lancer l'indexation (`ingest.mjs`).

### Phase 8 — Tests & évaluation
- [ ] Jeu de questions de référence (réponses + sources attendues).
- [ ] Tests de **refus** (questions hors périmètre → « je n'ai pas trouvé »).
- [ ] Vérifier l'**exactitude des citations** (pas de source inventée).

### Phase 9 — Production & maintenance
- [ ] Mise à jour du corpus (nouveaux accords) → ré-indexation.
- [ ] Suivi des quotas gratuits ; monitoring ; retours des militants.

---

## 4. Format des sources

Voir [`sources/FORMAT.md`](sources/FORMAT.md) — front-matter + découpage par
article. C'est **le seul prérequis** pour lancer l'indexation.

---

## 5. Déploiement — commandes

Voir [`README.md`](README.md).

---

## Annexe A — Alternatives de modèle (si besoin)

| Option gratuite | Avantages | Limites |
|-----------------|-----------|---------|
| **Workers AI** (retenu) | tout intégré, pas d'entraînement sur tes données | qualité FR correcte (RAG strict compense) |
| **Google Gemini Flash** (free tier) | très bonne qualité FR | données free-tier possiblement réutilisées → moins bon pour la confidentialité |
| **Groq** (free tier) | très rapide (Llama/Mistral) | hébergement US, quotas variables |
| **Mistral La Plateforme** (free tier) | modèle français | quotas expérimentaux |

Le passage d'un fournisseur à l'autre ne change que la fonction d'appel LLM dans
`worker/src/index.js`.
