# Analyse du corpus & décisions d'indexation

Source : dossier Google Drive « Base documentaire ALFI » (Air Liquide France
Industrie), fourni le 2026-07-21 — **258 documents Markdown** générés depuis des
PDF/OCR/bureautique (repères de page `<!-- p.N -->`, pas de front-matter).

## Contenu (8 thèmes)

| Thème | Nb | Nature |
|---|---|---|
| 00 – Références | 4 | Code du travail (7,7 Mo), Code de l'environnement (7,5 Mo), **Convention collective Chimie — brochure 3108 / IDCC 44** (1,85 Mo) + synthèse |
| 01 – Durée du travail & astreintes | 18 | Accords d'entreprise |
| 02 – Égalité pro, QVT | 10 | Accords + sous-dossier Télétravail |
| 03 – Épargne salariale | 3 | Participation, intéressement |
| 04 – Instances & représentants | 17 | Accords CSE/CSEC, droit syndical, comité de groupe/CEE |
| 05 – NAO | 10 | NAO 2019→2024, revendications |
| 06 – Accords applicables | 4 | Branche Chimie, salaires, handicap, parcours élus |
| 07 – CSE (PV & CSSCT) | 192 | PV/ODJ/CR de réunions, rapports d'accidents, budgets, bilans |

## Décisions de périmètre (validées)

- ✅ **Chatbot = thèmes 00–06** (textes normatifs : code du travail, code de
  l'environnement, convention collective, accords, NAO).
- ❌ **Thème 07 exclu** (192 PV CSE/CSSCT) — contient des **données personnelles**
  (collègues nommés, accidents, situations individuelles). Risque RGPD si cité
  dans les réponses. Reste consultable dans le Drive.
- ✅ **Code de l'environnement inclus** (partie législative, 7 655 extraits,
  index séparé `search-env.json`, ~1,5 Mo gzip). Ce fichier utilise un format
  d'article **différent** du code du travail — titres Markdown purs
  `### L. 211-1` (sans le mot « Article ») au lieu de `**Article L2312-8**` — et
  contient une ligne de navigation parasite recopiée du site source après
  chaque article (« Legif. Plan Jp.Judi. Jp.Admin. Juricaf »). Les deux
  particularités sont gérées par `ingest/chunk.mjs` (détection du format titre
  pur) et `build-index.mjs` (nettoyage de la ligne parasite).

## Découpage (RAG)

Les articles ne sont pas des titres Markdown mais des lignes « Article N … ».
Découpeur `ingest/chunk.mjs` :
1. coupe aux **frontières fortes** (début d'article + titres Markdown) ;
2. **re-découpe** les blocs trop longs (annexes, articles OCR sur une seule
   ligne) par repère de page puis par phrase, cible ~1 600 car. (max 2 600) ;
3. annote chaque chunk avec l'**article** détecté et la **page** courante.

Métadonnées déduites du **chemin + nom de fichier** (`ingest/ingest.mjs`), sans
front-matter. Citation affichée : *article* pour code/CC, *document + page* pour
les accords (docs internes, pas d'URL Légifrance par article).

**Validation réelle** sur la convention 3108 : 1 675 chunks, tous ≤ 2 600 car.,
médiane 1 335, page tracée sur 100 %, 699 articles détectés.

## Volume & offre gratuite — point d'attention

Estimation : convention **~1 675** chunks · accords/NAO **~900** · code du travail
complet **~7 000**. Soit **~2 600 chunks sans le code du travail**, **~9 500 avec**.

- Sans le code du travail (convention + accords + NAO) : **confortable en gratuit**.
- Avec le code du travail complet : l'indexation devra se faire **par passes**
  (quota journalier Workers AI) et pourra **approcher les limites de stockage
  Vectorize gratuit** — à vérifier au déploiement. Options si besoin : n'indexer
  que les livres du code utiles au terrain, réduire la dimension d'embedding, ou
  passer à l'offre Workers payante (~5 €/mois).

**Recommandation de démarrage** : indexer d'abord convention + accords + NAO
(cœur ALFI, 100 % gratuit), valider le chatbot, puis ajouter le code du travail.

## Reste à faire pour la mise en ligne

1. Compte Cloudflare (gratuit) → `wrangler` : créer l'index Vectorize, déployer
   le Worker, définir `INGEST_SECRET`.
2. Copier les sources 00–06 en local puis lancer `ingest/ingest.mjs`.
3. Brancher le widget dans `index.html` (Phase 6) et tester (réponses + refus).
