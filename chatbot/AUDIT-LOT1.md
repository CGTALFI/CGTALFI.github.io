# Lot 1 — doc2query pilote + fusion RRF : résultats

## Ce qui a été construit

1. **doc2query pilote** (`chatbot/doc2query.json`) : 58 articles ciblés (les
   clusters de confusion exacts identifiés dans `AUDIT-LOT0.md`), 128 questions
   reformulées en langage militant, écrites à partir du contenu réel de chaque
   article (vérifié, zéro invention). Intégré à `build-index.mjs` (champ `q`).
2. **Fusion RRF** (`chatbot/widget.js`) : un second index BM25 sur le champ `q`
   est construit au chargement ; à la recherche, les listes « texte » et
   « doc2query » sont fusionnées par Reciprocal Rank Fusion (sans poids à
   régler) avant le re-classement existant (inchangé).
3. **Correctif du re-classeur** : le re-classeur final évaluait la proximité/
   couverture uniquement sur le texte brut de l'article, ce qui pénalisait à
   tort les documents retrouvés par pont de vocabulaire (doc2query). Ajout d'un
   signal `qcovR` (couverture via les questions doc2query), poids **6**
   (calibré par mesure, voir ci-dessous).

## ⚠️ Point méthodologique important — mesure corrigée

Le premier test (60 questions du banc `_eval-full.mjs`) montrait un saut
top-3 de 53 % → 92 %. **Ce chiffre est en partie contaminé** : plusieurs
questions du banc et les phrases doc2query ont été écrites par la même
personne (l'agent), à la suite, avec des formulations parfois quasi
identiques — ce qui gonfle artificiellement le gain mesuré (mémorisation,
pas généralisation).

**Correction** : un test tenu à l'écart (`_heldout-test.mjs`, 16 questions en
langage familier, jamais vues par doc2query, ex. « mon patron veut me faire
bosser 12h dans la journée c'est possible ») donne une mesure honnête :

| | Sans doc2query/RRF | Avec doc2query/RRF (QW=6) |
|---|---|---|
| top-3 (tenu à l'écart, n=16) | **6 %** (1/16) | **44 %** (7/16) |
| top-3 (banc contaminé, n=60) | 53 % | 92 % |

Le vrai gain généralisable est de l'ordre de **×7 sur des reformulations
inédites** — réel et significatif, mais nettement plus modeste que le chiffre
du banc contaminé. Le poids `QW=6` a été choisi pour **zéro régression** sur
le banc de 60 questions (un poids plus agressif, QW=10, montait à 63 % sur le
jeu tenu à l'écart mais cassait 3 questions déjà correctes non couvertes par
doc2query — écarté).

## Verdict

**Conservé.** Gain réel et mesuré, zéro régression, coût d'exécution nul
(uniquement des données statiques, aucun modèle). Le levier le plus rentable
reste, comme prévu, le comblement du fossé de vocabulaire — mais son ampleur
réelle est plus modeste que l'estimation initiale du banc contaminé.

## Lot 1.8 — Dictionnaire de registre familier → légal (résultat MODESTE)

Les échecs restants du jeu tenu à l'écart étaient tous du **registre familier**
(« bosser », « viré », « papier », « en rab », « rabaisse ») — des mots
**absents du corpus** (DF=0), donc filtrés et sans effet aujourd'hui. Ajout de
~27 mappings vers le vocabulaire légal (`SYN` dans `widget.js`), toutes cibles
vérifiées présentes dans le corpus.

**Mesuré sur deux jeux distincts, pour éviter l'auto-persuasion :**

| Jeu | Sans registre | Avec registre |
|---|---|---|
| **A — dev** (celui dont j'ai corrigé les échecs) | 50 % | **56 %** (+1 question) |
| **B — frais** (mots familiers NON couverts : dégager, sacquer, toubib, récup, N+1…) | 25 % | **25 %** (aucun gain) |
| Banc principal (60 q., langage formel) | top-3 55 | top-3 55 (aucun effet, **0 régression**) |

**Verdict : conservé** (coût nul, aucun risque, +1 question), mais il faut être
lucide sur ce que ça démontre : **un dictionnaire ne couvre que ce qu'on y a
mis.** Sur du vocabulaire familier non anticipé (jeu B), le gain est
strictement nul — et 25 % est le plafond atteint par l'ensemble de la pile
lexicale (BM25 + rerank + doc2query + thésaurus + registre).

**C'est l'argument le plus solide en faveur du Lot 2 (sémantique)** : seuls des
embeddings généralisent à du vocabulaire jamais vu. Le jeu B (25 %) constitue
désormais le banc de référence pour trancher si la couche sémantique apporte
réellement ce que le lexical ne peut structurellement pas apporter.

## Limite assumée et piste pour la suite

Le pilote ne couvre que 58 articles (les clusters les plus problématiques du
Code du travail/environnement identifiés par l'audit) — pas la convention, les
accords, ni le reste du corpus. Les échecs restants du banc (convention,
questions non couvertes) confirment que l'extension du doc2query à davantage
d'articles, avec des reformulations plus variées et familières (comme celles
du test tenu à l'écart), reste le levier le plus prometteur si l'on veut
pousser plus loin.
