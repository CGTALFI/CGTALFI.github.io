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
 index.html ─┬─(fetch 1, à l'ouverture)─► chatbot/search-index.json  (socle ALFI, ~0,8 Mo gz)
 widget inline│─(fetch 2, arrière-plan)──► chatbot/search-code.json   (code du travail, ~1,9 Mo gz)
   (BM25++)   │
              └─ n° d'article direct · synonymes/sigles · pondération · citation exacte
```

- **Widget** : déjà **inliné** dans `index.html` (bulle 🔍 en bas à droite, visible
  uniquement dans l'app). Rien à installer.
- **Deux index**, générés par `build-index.mjs` depuis `sources/` :
  - `search-index.json` — convention + accords + NAO (~3 000 extraits) ;
  - `search-code.json` — **code du travail, partie législative** (~12 500 articles,
    chargé en arrière-plan puis mis en cache).
- **Moteur** (recherche en 2 étapes, réglée par banc d'évaluation) : rappel
  **BM25** → **re-classement** des 50 meilleurs (phrase, proximité, couverture,
  champ). Plus **accès direct par numéro d'article** (`L2312-8`), **synonymes/
  sigles** (CSE, CSSCT, RTT, NAO…) et garde-fou anti-hors-sujet. Aucune IA
  générative → aucune invention. (Réglage/mesure : `_eval.mjs`, dev only.)

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
node build-index.mjs     # régénère LES DEUX index (socle + code du travail)
```

Puis publier `index.html` + `chatbot/search-index.json` + `chatbot/search-code.json`.

## Mise en ligne (une fois)

Le dépôt doit servir, à côté de `index.html` :
- `chatbot/search-index.json` **et** `chatbot/search-code.json` (générés ci-dessus).

Sur GitHub Pages, poussez ces fichiers. Les URLs sont surchargeables via
`window.CGT_INDEX_URL` et `window.CGT_CODE_URL` (juste avant `</body>`).

## Vérifications

- **Numéro d'article** : « L2312-8 », « L3141-3 » → l'article exact du code arrive
  en tête, avec son chemin (Partie › Livre › Titre › Chapitre).
- **Langage naturel + synonymes** : « heures de délégation CSE » → L2315-7 ;
  « combien de jours pour un décès » → L3142-4 ; « durée maximale astreinte » →
  Article 5 des accords ; « prime d'ancienneté » → Convention Article 10.
- **Hors-corpus** (« recette de crêpes ») → refus « Je n'ai pas trouvé… ».

## Bon à savoir

- **Corpus public** : `search-index.json` embarque le **texte des accords** ; il
  est donc téléchargeable par quiconque accède au site. Validé pour les thèmes
  00–06. Le **thème 07** (PV CSE/CSSCT, données personnelles) reste **exclu**.
- **Mobile** : l'index (~858 Ko gzip) n'est chargé qu'à la **première ouverture**
  du chat, puis mis en cache par le navigateur.
- **Non-conseil** : réponses informatives, ne remplacent pas un·e délégué·e.
- **Qualité de recherche** : BM25 (mots-clés) avec repli anti-bruit (refus si
  moins de deux termes de la question existent dans le corpus).
