# Extension du doc2query — résultats et incident méthodologique

Suite logique des Lots 2/3 : puisque **aucun modèle** (ni bi-encodeur ni
cross-encodeur) ne résout le problème du langage familier — parce que c'est un
problème de **rappel**, pas de classement (voir `AUDIT-LOT2-3.md`) — le seul
levier restant est d'injecter le vocabulaire courant **dans l'index**.

## Ce qui a été fait

- doc2query passé de **58 à 156 articles** (352 formulations), couvrant le cœur
  militant : discipline/licenciement, temps de travail, repos/congés, CSE/IRP,
  droit syndical, santé-sécurité, salaire/paie, contrat (CDD/CDI/temps partiel),
  maternité/paternité, épargne salariale.
- Formulations écrites **à partir du contenu réel de chaque article** et dans un
  registre volontairement familier (« filer un local », « ils veulent me virer »,
  « le toubib », « des heures en rab »).

## ⚠️ Incident méthodologique — à lire avant les chiffres

Un jeu de test (**JEU C**, 24 questions) avait été **scellé avant** l'écriture du
doc2query, précisément pour mesurer la généralisation. **Le protocole a échoué** :
ayant ces questions en mémoire au moment de rédiger les formulations, j'en ai
reproduit **22 sur 24 de façon quasi verbatim** dans le doc2query. La première
mesure (96 % en top-3) ne mesurait donc que de la **mémorisation** — elle est
sans valeur.

**Correction appliquée** : détection automatique par similarité (Jaccard ≥ 0.55
sur les mots significatifs) et **retrait de 44 formulations** trop proches des
questions de test (396 → 352). Les chiffres ci-dessous sont ceux **après**
décontamination.

Ils restent probablement **légèrement optimistes** : même décontaminées, les
formulations conservées portent sur les mêmes thèmes que les questions de test,
puisque j'ai écrit les deux. Une validation vraiment indépendante demanderait des
questions rédigées par des militants.

## Résultats (après décontamination)

| Jeu | Sans doc2query | doc2query 58 art. | **doc2query 156 art.** |
|---|---|---|---|
| **JEU C** — scellé, familier (n=24) | 33 % | 29 % | **54 %** |
| JEU C — top-1 | 1/24 | 0/24 | **10/24** |
| JEU B — familier (n=12) | 0 % | 50 % | 42 % |
| **Banc formel** (n=16) — non-régression | 25 % | 100 % | **100 %** (top-1 7→10) |

**Lecture :**
- Gain net et substantiel sur le langage familier : **top-3 de 33 % à 54 %**, et
  surtout **top-1 de 1 à 10 sur 24** — c'est-à-dire que dans 10 cas sur 24, le
  bon article arrive désormais **en première position** là où il n'y arrivait
  quasiment jamais.
- **Aucune régression** sur le langage formel (100 % maintenu, top-1 amélioré).
- Le jeu B recule légèrement (50 % → 42 %, soit 1 question sur 12) : bruit à cet
  effectif, et ce jeu reste le plus affecté par la décontamination.

## Verdict

**Conservé.** C'est, de loin, le meilleur rapport gain/coût de tout le projet :
- **0 octet** de téléchargement supplémentaire pour l'utilisateur (les
  formulations sont dans l'index, dont la taille varie de ~0,1 %) ;
- aucun modèle, aucun serveur, aucune dépendance ;
- gain mesuré là où tous les modèles testés (e5-small 118 Mo, cross-encoder
  544 Mo) avaient échoué.

## Suite recommandée

Le levier n'est pas épuisé : 156 articles sur ~23 000 extraits. Étendre la
couverture (et surtout **faire relire/enrichir les formulations par des
militants**, ce qui réglerait aussi le problème d'indépendance du test) reste
l'action la plus rentable.
