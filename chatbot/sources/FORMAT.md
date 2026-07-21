# Format des sources

Le corpus réel (« Base documentaire ALFI ») vient de PDF/OCR/bureautique : les
fichiers **n'ont pas de front-matter**. Les métadonnées sont donc déduites du
**chemin + nom de fichier**, et le découpage est **structurel** (voir
[`../ANALYSE-CORPUS.md`](../ANALYSE-CORPUS.md)).

## Où déposer les fichiers

Reproduire l'arborescence des thèmes 00–06 du Drive sous `sources/` :

```
sources/
├── 00 - Références/
│   ├── Codes/code_du_travail_complet.md
│   └── Convention collective/3108.md   (+ synthese_3108.md)
├── 01 - Durée du travail & astreintes/*.md
├── 02 - Égalité pro, QVT & conditions de travail/*.md   (+ TELETRAVAIL/)
├── 03 - Épargne salariale/*.md
├── 04 - Instances & représentants du personnel/*.md
├── 05 - NAO/*.md
└── 06 - Accords applicables/*.md   (+ Droit syndical/)
```

## Règles de typage (déduites par `ingest/ingest.mjs`)

| Chemin contient… | `type` | Citation |
|---|---|---|
| `Convention collective/` | `convention_collective` | Convention Chimie (IDCC 44) — Article N |
| `/Codes/` ou `code_du_travail` | `code_du_travail` | Code du travail — Article L. … |
| `05 - NAO/` | `nao` | Nom du document — p.N |
| autre | `accord` | Nom du document — p.N |

## Exclusions automatiques

`ingest.mjs` ignore : `README.md`, `FORMAT.md`, le **thème 07** (PV CSE/CSSCT,
données personnelles) et le **code de l'environnement** — conformément aux
décisions de périmètre. Pour indexer malgré tout, ajuster `EXCLUDE` dans
`ingest.mjs`.

## Repères de page

Les `<!-- p.N -->` présents dans les fichiers issus de PDF sont utilisés pour la
citation « document + page » : à conserver tels quels.
