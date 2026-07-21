# Format des sources Markdown

Pour que le chatbot cite **exactement** la bonne référence, chaque fichier suit
ce format simple : un **front-matter** (métadonnées du document) puis le texte
**découpé par article / section** avec des titres de niveau 2 (`##`).

Chaque bloc `##` devient une **unité citable** (un « chunk »). Sa citation est
construite à partir du front-matter (`titre`, `url`) + du titre du bloc.

---

## Front-matter (en tête de chaque fichier)

```markdown
---
type: convention_collective      # convention_collective | accord | code_du_travail
titre: "Convention collective nationale de la métallurgie"
reference: "IDCC 3248"           # identifiant lisible du document
url: "https://www.legifrance.gouv.fr/conv_coll/id/KALICONT000044426703"
date_maj: "2024-01-01"           # date de la version utilisée (AAAA-MM-JJ)
---
```

| Champ | Obligatoire | Rôle |
|-------|-------------|------|
| `type` | oui | catégorie (sert au filtrage et à l'affichage) |
| `titre` | oui | apparaît dans la citation |
| `reference` | recommandé | IDCC, n° d'accord, etc. |
| `url` | oui | lien cliquable affiché sous la réponse |
| `date_maj` | recommandé | traçabilité de la version |

---

## Corps : un `##` par article / section

```markdown
## Article 12 — Congés pour événements familiaux

Le salarié bénéficie, sur justification, d'une autorisation exceptionnelle
d'absence de :
- 4 jours pour son mariage ou la conclusion d'un Pacs ;
- 3 jours pour chaque naissance ou arrivée d'un enfant en vue d'adoption ;
- 5 jours pour le décès d'un enfant.

## Article 13 — Prime d'ancienneté

...
```

- **Un article = un bloc `##`.** C'est l'unité qui sera retrouvée et citée.
- Le **titre du bloc** doit contenir la référence (« Article 12 — … », « L. 1132-1 — … »).
- Évitez les blocs trop longs (> ~500 mots) : découpez en sous-articles si besoin.
- Le Markdown interne (listes, gras) est conservé.

---

## Organisation des fichiers

```
sources/
├── convention-collective.md          # 1 fichier (ou plusieurs si volumineux)
├── accords/
│   ├── accord-teletravail-2023.md
│   └── accord-nao-2024.md
└── code-du-travail/
    ├── licenciement.md               # regroupe les articles L. 1231-x, etc.
    └── duree-du-travail.md
```

> Pour le code du travail, **regroupez par thème** les articles pertinents
> (un fichier « licenciement », un fichier « congés », etc.), un `##` par article,
> avec l'URL Légifrance de chaque article dans le titre ou en note.

Un exemple complet est fourni : [`exemple-convention-collective.md`](exemple-convention-collective.md).
