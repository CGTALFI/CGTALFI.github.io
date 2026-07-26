# Assistant documentaire — solution retenue : recherche 100 % navigateur

**Aucun serveur, aucune clé API, aucun compte, gratuit à vie.** L'assistant
cherche dans le corpus (convention, accords, NAO) directement dans le navigateur
et **cite l'extrait exact**. Il n'y a **aucune IA générative** → aucune
invention possible. C'est un moteur de recherche documentaire conversationnel.

> L'approche « backend Cloudflare » (dossier `worker/`, `ingest/`, `PLAN.md`)
> reste disponible si un jour vous voulez un vrai chatbot *rédigé*. Elle n'est
> **pas** utilisée par la solution ci-dessous.

## Comment ça marche

```
 index.html ─┬─(fetch 1, à l'ouverture)──────► chatbot/search-index.json  (socle ALFI, ~0,8 Mo gz)
 widget inline│─(fetch 2, arrière-plan)───────► chatbot/search-code.json   (code du travail, ~1,9 Mo gz)
   (BM25++)   │─(fetch 3, arrière-plan, après)► chatbot/search-env.json    (code environnement, ~1,5 Mo gz)
              │
              └─ n° d'article direct · synonymes/sigles · pondération · citation exacte
```

Les trois chargements sont **séquentiels** (socle → code du travail → code de
l'environnement), pas simultanés, pour ne pas saturer une connexion mobile.
Chaque étape affiche un message à l'utilisateur (voir « Séquence des messages »
ci-dessous) ; en cas d'échec d'un fetch en arrière-plan, les corpus déjà chargés
restent pleinement opérationnels (pas d'erreur bloquante).

- **Widget** : déjà **inliné** dans `index.html` (bulle 🔍 en bas à droite, visible
  uniquement dans l'app). Rien à installer.
- **Trois index**, générés par `build-index.mjs` depuis `sources/` :
  - `search-index.json` — convention + accords + NAO (~3 000 extraits) ;
  - `search-code.json` — **code du travail, partie législative** (~12 500 articles) ;
  - `search-env.json` — **code de l'environnement, partie législative**
    (~7 700 articles) ; chargé en dernier, en arrière-plan, puis mis en cache.
- **Moteur** — recherche en deux temps, chaque réglage validé par banc d'essai :
  1. **Rappel** : BM25 sur le texte **fusionné (RRF)** avec un second index BM25
     sur les questions **doc2query** (`chatbot/doc2query.json` : ~156 articles,
     reformulations en langage militant, indexées avec l'extrait). Plus
     **compréhension du langage courant** : synonymes/sigles étendus et
     dictionnaire de **situations** (phrase/inquiétude du quotidien → concepts
     juridiques), rescue orthographique en dernier recours.
  2. **Re-classement** du pool fusionné : phrase, proximité, couverture, champ.
  Plus : **accès direct par numéro d'article** (`L2312-8`, `L. 211-1`, avec ou
  sans préfixe L/R/D) et **garde-fou anti-hors-sujet**.
  Aucune IA générative → aucune invention. (Réglage/mesure : `_eval.mjs`, dev only.)

> **Modèles d'IA : testés et écartés, par la mesure.** Un bi-encodeur (e5-small)
> et un cross-encodeur (bge-reranker-v2-m3) ont été évalués pour améliorer le
> rappel sur le langage familier : le premier n'apporte qu'un gain marginal, le
> second **dégrade** les résultats. Raison de fond : le problème est un problème
> de **rappel** (les bons mots ne sont pas dans l'index), pas de classement — un
> re-classeur ne peut pas retrouver ce que la recherche n'a pas ramené. Détails
> et chiffres : `AUDIT-LOT2-3.md`. Le levier qui marche est le doc2query
> (`AUDIT-DOC2QUERY-ETENDU.md`).

### Séquence des messages affichés à l'utilisateur

| Étape | Message |
|---|---|
| Ouverture du chat | *Chargement de la base documentaire…* |
| Socle chargé | *Base prête : **N** extraits (convention, accords, NAO). Le code du travail et le code de l'environnement se chargent en arrière-plan…* |
| Code du travail chargé | *✅ Code du travail chargé (**N** articles). Chargement du code de l'environnement…* |
| Code environnement chargé | *✅ Code de l'environnement chargé (**N** articles) — recherche complète (convention, accords, NAO, code du travail, code de l'environnement).* |

## Tester en local (avant mise en ligne)

⚠️ Un **double-clic** sur `index.html` NE suffit PAS pour le chatbot : les
navigateurs bloquent le chargement des index (`fetch` en `file://`). L'app
s'affiche, mais le chatbot dira « impossible de charger la base ». Il faut servir
le dossier en `http://` — un lanceur sans installation est fourni :

```bash
cd <dossier qui contient index.html>
node serve-local.mjs
```

Puis ouvrir **http://localhost:8080**. (Alternative : `python -m http.server 8080`.)

## Mettre à jour le corpus (opération récurrente)

Quand un texte change dans `sources/`, **ou** quand on enrichit
`chatbot/doc2query.json` :

```bash
cd chatbot
node build-index.mjs     # régénère LES TROIS index (socle + code du travail + environnement)
```

Puis publier `index.html` + les trois `chatbot/search-*.json`.

## Améliorer la pertinence : enrichir `doc2query.json`

**C'est le levier le plus rentable** (voir `AUDIT-DOC2QUERY-ETENDU.md`) pour la
compréhension du langage familier, sans aucun téléchargement supplémentaire
pour l'utilisateur.

Le principe : associer à un article les **questions qu'un·e militant·e poserait
vraiment**, dans son vocabulaire. Elles sont indexées avec l'article, ce qui le
rend trouvable même quand la question n'emploie aucun mot du texte de loi.

```json
"Article L. 3133-4": [
  "le 1er mai est férié et chômé",
  "premier mai travail interdit"
]
```

Règles :
- écrire **d'après le contenu réel** de l'article (ne jamais inventer une règle) ;
- **registre courant** (« filer un local », « ils veulent me virer », « le toubib »),
  c'est là que se situe le gain — pas dans des paraphrases juridiques ;
- 3 à 8 formulations par article suffisent ; la clé doit correspondre **exactement**
  à la référence produite par le chunker (« Article L. 3133-4 », avec l'espace
  après le point) ;
- après modification, relancer `node build-index.mjs` puis le test de
  non-régression avant de publier.

## Mise en ligne (une fois)

Le dépôt doit servir, à côté de `index.html` :
- `chatbot/search-index.json`, `chatbot/search-code.json` **et** `chatbot/search-env.json`
  (générés ci-dessus).

Sur GitHub Pages, poussez ces fichiers. Les URLs sont surchargeables via
`window.CGT_INDEX_URL`, `window.CGT_CODE_URL` et `window.CGT_ENV_URL` (juste
avant `</body>`).

## Vérifications

- **Numéro d'article** : « L2312-8 », « L3141-3 » (code du travail), « L. 211-1 »
  (code de l'environnement) → l'article exact arrive en tête, avec son chemin
  (Partie › Livre › Titre › Chapitre).
- **Langage naturel + synonymes** : « heures de délégation CSE » → L2315-7 ;
  « combien de jours pour un décès » → L3142-4 ; « durée maximale astreinte » →
  Article 5 des accords ; « prime d'ancienneté » → Convention Article 10 ;
  « déchets dangereux » → articles du Livre V du code de l'environnement.
- **Hors-corpus** (« recette de crêpes ») → refus « Je n'ai pas trouvé… ».

## Bon à savoir

- **Corpus public** : les index embarquent le **texte des accords et des codes** ;
  ils sont donc téléchargeables par quiconque accède au site. Validé pour les
  thèmes 00–06. Le **thème 07** (PV CSE/CSSCT, données personnelles) reste **exclu**.
- **Mobile** : les index (socle ~0,8 Mo, code du travail ~1,9 Mo, environnement
  ~1,5 Mo gzip) ne sont chargés qu'à la **première ouverture** du chat, l'un
  après l'autre, puis mis en cache par le navigateur. Le socle répond toujours
  instantanément, avant même la fin des deux autres chargements.
- **Non-conseil** : réponses informatives, ne remplacent pas un·e délégué·e.
- **Qualité de recherche** : BM25 + re-classement, avec repli anti-bruit (refus
  si moins de deux termes de la question existent dans le corpus).
- **RRF (fusion texte + doc2query)** : les deux listes sont plafonnées à leur
  propre top 50 *avant* fusion et normalisées *séparément* (échelles BM25
  différentes selon la taille du champ indexé) — sinon un document au score
  brut anormalement élevé sur un champ dense en mots génériques peut évincer
  à tort de bons candidats du pool de re-classement.
- **Format du code de l'environnement** : ce fichier utilise des titres Markdown
  purs (`### L. 211-1`, sans le mot « Article ») et contient une ligne de
  navigation parasite après chaque article — les deux sont gérés spécifiquement
  par `ingest/chunk.mjs` et `build-index.mjs` (voir `ANALYSE-CORPUS.md`).
