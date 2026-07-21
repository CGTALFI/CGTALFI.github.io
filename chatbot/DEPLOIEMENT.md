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
- **Moteur** (recherche en 2 étapes, réglée par banc d'évaluation) : rappel
  **BM25** → **re-classement** des 50 meilleurs (phrase, proximité, couverture,
  champ). Plus **accès direct par numéro d'article** (`L2312-8`, `L. 211-1`),
  **synonymes/sigles** (CSE, CSSCT, RTT, NAO…) et garde-fou anti-hors-sujet.
  Aucune IA générative → aucune invention. (Réglage/mesure : `_eval.mjs`, dev only.)

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

## Mettre à jour le corpus (seule opération récurrente)

Quand un texte change dans `sources/` :

```bash
cd chatbot
node build-index.mjs     # régénère LES TROIS index (socle + code du travail + environnement)
```

Puis publier `index.html` + `chatbot/search-index.json` + `chatbot/search-code.json`
+ `chatbot/search-env.json`.

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
- **Format du code de l'environnement** : ce fichier utilise des titres Markdown
  purs (`### L. 211-1`, sans le mot « Article ») et contient une ligne de
  navigation parasite après chaque article — les deux sont gérés spécifiquement
  par `ingest/chunk.mjs` et `build-index.mjs` (voir `ANALYSE-CORPUS.md`).
