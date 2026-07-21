#!/usr/bin/env node
/**
 * Construit l'index de recherche EMBARQUÉ (option « recherche navigateur »).
 *
 * Aucun serveur, aucune clé, aucun compte : ce script lit le corpus local
 * (sources/ 00–06), le découpe avec chunk.mjs, déduit les métadonnées du chemin
 * (comme ingest.mjs) et écrit un JSON compact `search-index.json` que le widget
 * charge côté navigateur pour faire une recherche plein-texte (BM25) avec
 * citation de la source exacte. Le modèle génératif est volontairement absent
 * → zéro hallucination.
 *
 * Deux index (« shards ») sont produits :
 *   - search-index.json : socle ALFI (convention + accords + NAO) — léger ;
 *   - search-code.json  : code du travail (partie législative) — chargé à part
 *     par le widget, en arrière-plan (mobile préservé).
 *
 * Utilisation :
 *   node build-index.mjs                 # régénère les deux shards
 *
 * Node >= 18. Aucune dépendance externe.
 */
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, relative, basename } from "node:path";
import { chunkDocument } from "./ingest/chunk.mjs";

const SOURCES_DIR = process.env.SOURCES_DIR || join(import.meta.dirname, "sources");
const OUT_CORE = process.env.OUT || join(import.meta.dirname, "search-index.json");
const OUT_CODE = join(import.meta.dirname, "search-code.json");

// Exclusions : PV CSE/CSSCT (07, données personnelles), code de l'environnement.
const EXCLUDE = [/(^|\/)07 - /i, /code_environnement/i];

async function listMarkdown(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listMarkdown(full)));
    else if (entry.name.endsWith(".md") && !/^(README|FORMAT)\.md$/i.test(entry.name)) out.push(full);
  }
  return out;
}

// Métadonnées déduites du chemin + nom de fichier (aligné sur ingest.mjs).
function metaFromPath(rel) {
  const theme = rel.split(/[\\/]/)[0];
  const file = basename(rel).replace(/\.md$/i, "");
  let type = "accord";
  let titre = file;
  if (/Convention collective/i.test(rel)) {
    type = "convention_collective";
    titre = "Convention collective nationale des industries chimiques (IDCC 44, brochure 3108)";
  } else if (/[\\/]Codes[\\/]/i.test("/" + rel) || /code_du_travail/i.test(file)) {
    type = "code_du_travail";
    titre = "Code du travail";
  } else if (/^05 - NAO/i.test(theme)) {
    type = "nao";
  }
  return { theme, type, titre, source_path: rel };
}

// Nettoyage d'affichage : retire les repères de page HTML.
function clean(t) {
  return t.replace(/<!--\s*p\.\d+\s*-->/g, "").replace(/[ \t]+\n/g, "\n").trim();
}

const files = (await listMarkdown(SOURCES_DIR)).filter(
  (f) => !EXCLUDE.some((re) => re.test(relative(SOURCES_DIR, f))),
);
console.log(`${files.length} fichier(s) à indexer.`);

const core = []; // convention + accords + NAO
const code = []; // code du travail (partie législative)
for (const file of files) {
  const rel = relative(SOURCES_DIR, file).replace(/\\/g, "/");
  const meta = metaFromPath(rel);
  const chunks = chunkDocument(await readFile(file, "utf8"));
  for (const c of chunks) {
    const x = clean(c.text);
    if (x.length < 40) continue; // ignore fragments trop courts
    const rec = {
      t: meta.titre,                                   // titre
      r: c.article || (c.page ? `p.${c.page}` : ""),   // référence (article ou page)
      p: c.page || "",                                 // page
      ty: meta.type,                                   // type
      s: rel,                                          // chemin source
      x,                                               // texte de l'extrait
    };
    if (meta.type === "code_du_travail") {
      if (c.path) rec.h = c.path;                      // chemin hiérarchique (code)
      code.push(rec);
    } else {
      core.push(rec);
    }
  }
}

async function emit(out, docs, label) {
  const payload = {
    meta: {
      genere: new Date().toISOString().slice(0, 10),
      corpus: label,
      extraits: docs.length,
      avis: "Informations indicatives — ne remplacent pas l'avis d'un·e délégué·e.",
    },
    docs,
  };
  await writeFile(out, JSON.stringify(payload), "utf8");
  const kb = Math.round((await stat(out)).size / 1024);
  console.log(`✅ ${docs.length} extraits → ${basename(out)} (${kb} Ko).`);
}

await emit(OUT_CORE, core, "Convention collective + accords + NAO");
await emit(OUT_CODE, code, "Code du travail (partie législative)");
