# Audit Lot 0 — Diagnostic rappel vs classement

Banc d'essai étendu à **60 questions** vérifiées (contenu réel confirmé),
couvrant les 5 corpus. Script : `_eval-full.mjs` (dev, gitignoré). Reproduit
exactement le pipeline du widget (`chatbot/widget.js`).

## Résultats globaux

| Métrique | Valeur |
|---|---|
| **Rappel@50** (BM25 brut) | **92 %** — plafond dur de tout re-classement |
| Rappel@15 (après rerank actuel) | 78 % |
| top-1 | 33 % |
| top-3 | 52 % |
| MRR | 0.454 |

Par corpus : code_travail (n=33) rappel@50 91 % / top-3 36 % ; code_env (n=11)
91 % / 55 % ; convention (n=4, échantillon faible) 75 % / 25 % ; accord (n=6)
100 % / 100 % ; NAO (n=6) 100 % / 100 %.

## Réponses aux 3 questions ouvertes du plan

1. **Le corpus contient-il la réponse ?** Oui, dans tous les cas audités —
   aucun article « gold » manquant de l'index, aucun cas de « réponse absente
   du corpus ». Pas de plafond structurel détecté.
2. **Rappel@50 réel : 92 %.** C'est le plafond dur : même un re-classeur
   parfait ne dépasserait pas 92 % de rappel utile avec le pipeline de rappel
   actuel. Marge d'amélioration côté rappel : ~8 points (vocabulaire).
3. Cross-encoder opt-in : reste pertinent (voir conclusion).

## Catégorisation des 29 échecs (découpe / vocabulaire / classement / corpus)

- **Découpe : 0/29.** Aucun échec dû à un mauvais découpage. Confirme que le
  travail de découpe par article + chemin hiérarchique (sessions précédentes)
  tient la route — pas la cause des échecs restants.
- **Corpus (réponse absente) : 0/29.** Tous les articles gold existent et
  contiennent le bon contenu, vérifié directement dans les index.
- **Vocabulaire (absent du rappel@50) : 7/29 (~24 % des échecs, ~12 % du
  total).** Ex. vérifiés : « AGS » (sigle informel absent du texte légal et du
  thésaurus) → L.3253-16 manqué ; « consultations récurrentes » (terme de
  synthèse, pas verbatim dans l'article) → L.2312-17 manqué.
- **Classement (le bon article est rappelé mais mal placé) : 22/29 (~76 % des
  échecs, ~37 % du total).** Très majoritairement des **confusions entre
  articles voisins du même chapitre** (ex. L.3121-18 vs L.3121-19, L.1234-1 vs
  L.1234-4, L.1152-1 vs L.1152-4/5) — le bon sujet est trouvé, mais l'article
  précis est noyé parmi des voisins topicalement proches.
- **Note méthodologique** : quelques échecs de classement sont en partie des
  artefacts d'étiquetage à réponse unique (ex. « harcèlement moral » a
  plusieurs articles légitimement pertinents L.1152-1 à -5 ; « heures
  supplémentaires » trouve un accord ALFI tout aussi valide en premier) — pas
  de vrais échecs du point de vue d'un militant.

## Conclusion — priorisation confirmée pour les lots suivants

**Le classement, pas le rappel, est le goulot d'étranglement dominant**
(22 vs 7). Ça confirme et affine le diagnostic du document externe analysé :
- **Lot 1** (doc2query, expansion de termes, Lefff) : cible bien les ~7 échecs
  de vocabulaire, gain attendu modéré mais réel.
- **Lot 2/3** (embeddings, cross-encoder) : cible directement le problème
  dominant — discriminer entre articles voisins topicalement proches, exercice
  où un scoring sémantique fin (surtout un cross-encoder joint) est justement
  le point fort par rapport au lexical pur. **Priorité confirmée sur ces
  lots**, pas seulement sur le vocabulaire.
