# Lots 2 & 3 — Sémantique et cross-encoder : mesures et verdicts

Banc de référence : **JEU B** (12 questions en langage familier — « dégager »,
« sacqué », « toubib », « récup », « N+1 » — vocabulaire volontairement NON
couvert par le thésaurus). C'est le plafond du lexical : **25 %** en top-3.

## Lot 2 — Sémantique bi-encodeur (e5-small, 118 Mo)

| Classement | top-3 (jeu B) |
|---|---|
| Lexical seul (référence) | 25 % (3/12) |
| Sémantique seul | 25 % (3/12) |
| Hybride RRF lexical+sémantique | **33 %** (4/12) |

Le sémantique attrape des cas que le lexical rate (« le planning me met 50h cette
semaine » → **L.3121-20**, invisible pour le lexical) mais en perd d'autres.
**Gain net : +1 question sur 12** — statistiquement négligeable, pour **118 Mo
par visiteur**.

**Verdict : écarté.** Confirme, sur un banc plus dur et non contaminé, le
résultat du premier test e5-small.

## Lot 3 — Cross-encoder

### Obstacle technique dirimant sur le modèle recommandé
Le document d'analyse recommandait `onnx-community/gte-multilingual-reranker-base`
en affirmant que ses « poids ONNX sont publiés explicitement pour
transformers.js ». **C'est faux en pratique** : le chargement échoue avec
`Unsupported model type: new` — l'architecture n'est pas implémentée dans
transformers.js (issue connue du dépôt). La variante `Xenova/mmarco-mMiniLMv2`
n'existe pas non plus.

Modèle de repli fonctionnel : **`onnx-community/bge-reranker-v2-m3-ONNX`**
(XLM-RoBERTa, architecture supportée) — mais **544 Mo quantifié**, bien au-delà
des ~300 Mo estimés.

### Le modèle discrimine remarquablement bien…
Test de contrôle sur une paire question/extrait :

| Paire | Logit |
|---|---|
| Article pertinent (L.3121-18, durée quotidienne) | **+2.87** |
| Article voisin (L.3121-20, durée hebdo — même sujet, mauvaise réponse) | +0.72 |
| Hors-sujet (budget CSE) | −11.01 |

C'est exactement la capacité que l'audit du Lot 0 désignait comme manquante
(départager des articles voisins), et qu'e5-small n'avait pas.

### …mais il n'apporte RIEN, pour une raison structurelle

| Jeu | Lexical seul | + cross-encoder |
|---|---|---|
| **Jeu B** (familier) | 25 % (3/12) | **25 %** (3/12) — aucun gain |
| **Banc formel** (échantillon) | **100 %** (12/12) | **67 %** (8/12) — **DÉGRADE** |

Deux enseignements :

1. **Sur le jeu B, aucun gain — pour une raison structurelle.** Un re-classeur
   ne peut reclasser que ce que le rappel a déjà trouvé. Sur du vocabulaire
   familier, l'article attendu n'entre jamais dans les candidats lexicaux : aucun
   modèle de re-classement, si bon soit-il, ne peut le récupérer. C'est
   exactement l'avertissement du document d'analyse (« si le rappel@50 plafonne,
   aucun reclassement ne dépassera ce plafond »), vérifié expérimentalement.

2. **Sur le banc formel, il DÉGRADE activement** : il casse 4 questions sur 12
   que le pipeline lexical réussissait (document unique, attributions du CSE,
   déchets dangereux, inventaire déchets radioactifs). Le modèle est entraîné sur
   des données web généralistes ; sur du droit français en extraits tronqués, son
   jugement de pertinence générique écrase les signaux spécifiques (doc2query,
   proximité, hiérarchie) patiemment réglés.

**Verdict : écarté sans hésitation.** 544 Mo par visiteur pour zéro gain là où
ça compte, et une régression là où tout marchait.

## Conclusion stratégique (la plus importante du projet)

Le problème se scinde en **deux régimes distincts**, qui appellent des remèdes
opposés :

| Régime | Rappel | Goulot | Ce qui marche |
|---|---|---|---|
| **Langage formel** (banc principal, 60 q.) | 92 % | **classement** | doc2query + RRF → top-3 de 53 % à 92 % |
| **Langage familier** (jeu B) | très bas | **rappel** | rien de testé ne marche… sauf injecter le vocabulaire dans l'index |

Autrement dit : **aucun modèle chargé dans le navigateur (bi-encodeur ou
cross-encodeur) ne résout le vrai problème restant**, parce que ce problème est
un problème de rappel, pas de classement.

**Le seul levier qui a démontré un effet sur le langage familier est le
doc2query** (×7 mesuré sur le jeu dev du Lot 1) — précisément parce qu'il
injecte les formulations familières *dans l'index*, donc *dans le rappel*.

### Recommandation
Étendre la couverture doc2query (aujourd'hui 58 articles seulement, avec des
reformulations trop proches du langage légal) avec :
1. beaucoup plus d'articles (cœur militant : CSE, temps de travail, contrat,
   santé-sécurité) ;
2. des reformulations **franchement familières** (« se faire dégager »,
   « le toubib », « des heures en rab », « mon N+1 »), et non des paraphrases
   juridiques.

C'est gratuit, sans modèle, sans poids de téléchargement, et c'est le seul
levier dont l'effet est mesuré sur ce régime.
