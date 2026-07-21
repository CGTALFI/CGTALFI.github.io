#!/usr/bin/env node
/**
 * Indexation du corpus ALFI (thèmes 00–06).
 *
 * Lit sources/**\/*.md, découpe chaque fichier (chunk.mjs — découpage par
 * article/section adapté aux transcriptions OCR), déduit les métadonnées du
 * chemin (pas de front-matter dans ce corpus), puis envoie les chunks par lots
 * au Worker `/admin/ingest`, qui calcule les embeddings et remplit Vectorize.
 *
 * Utilisation :
 *   WORKER_URL="https://cgt-chatbot.<compte>.workers.dev" \
 *   INGEST_SECRET="<le même secret que côté Worker>" \
 *   node ingest.mjs
 *
 * Node >= 18. Aucune dépendance externe.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative, basename } from "node:path";
import { createHash } from "node:crypto";
import { chunkDocument } from "./chunk.mjs";

const WORKER_URL = requireEnv("WORKER_URL").replace(/\/$/, "");
const INGEST_SECRET = requireEnv("INGEST_SECRET");
const SOURCES_DIR = process.env.SOURCES_DIR || join(import.meta.dirname, "..", "sources");
const BATCH = 40; // taille de lot pour les embeddings

// Exclusions de périmètre (décisions projet) : PV CSE/CSSCT (07) et code env.
const EXCLUDE = [/(^|\/)07 - /i, /code_environnement/i];
// Démarrage recommandé (offre gratuite) : indexer d'abord convention + accords +
// NAO, sans le code du travail complet (~5 300 chunks). Activer avec WITHOUT_CODE=1.
if (process.env.WITHOUT_CODE === "1") EXCLUDE.push(/code_du_travail/i, /(^|\/)Codes\//i);

async function listMarkdown(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listMarkdown(full)));
    else if (entry.name.endsWith(".md") && !/^(README|FORMAT)\.md$/i.test(entry.name)) out.push(full);
  }
  return out;
}

// Métadonnées déduites du chemin + nom de fichier
function metaFromPath(rel) {
  const theme = rel.split("/")[0];
  const file = basename(rel).replace(/\.md$/i, "");
  let type = "accord";
  let titre = file;
  if (/Convention collective/i.test(rel)) {
    type = "convention_collective";
    titre = "Convention collective nationale des industries chimiques (IDCC 44, brochure 3108)";
  } else if (/\/Codes\//i.test("/" + rel) || /code_du_travail/i.test(file)) {
    type = "code_du_travail";
    titre = "Code du travail";
  } else if (/^05 - NAO/i.test(theme)) {
    type = "nao";
  }
  return { theme, type, titre, source_path: rel };
}

function idFor(rel, i) {
  return createHash("sha1").update(`${rel}#${i}`).digest("hex").slice(0, 32);
}

async function postBatch(chunks) {
  const r = await fetch(`${WORKER_URL}/admin/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${INGEST_SECRET}` },
    body: JSON.stringify({ chunks }),
  });
  if (!r.ok) throw new Error(`Ingest ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── Programme principal ──────────────────────────────────────────────────────
const files = (await listMarkdown(SOURCES_DIR)).filter(
  (f) => !EXCLUDE.some((re) => re.test(relative(SOURCES_DIR, f))),
);
console.log(`${files.length} fichier(s) Markdown à indexer.`);

const all = [];
for (const file of files) {
  const rel = relative(SOURCES_DIR, file);
  const meta = metaFromPath(rel);
  const chunks = chunkDocument(await readFile(file, "utf8"));
  chunks.forEach((c, i) => {
    all.push({
      id: idFor(rel, i),
      texte: c.text,
      titre: meta.titre,
      reference: c.article || (c.page ? `p.${c.page}` : ""),
      page: c.page || "",
      type: meta.type,
      source_path: rel,
    });
  });
  console.log(`  ${rel} → ${chunks.length} chunk(s)`);
}

console.log(`\nTotal : ${all.length} chunks. Envoi par lots de ${BATCH}…`);
let done = 0;
for (let i = 0; i < all.length; i += BATCH) {
  const res = await postBatch(all.slice(i, i + BATCH));
  done += res.count || 0;
  console.log(`  ${done}/${all.length} indexés`);
}
console.log("✅ Indexation terminée.");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Variable d'environnement manquante : ${name}`);
    process.exit(1);
  }
  return v;
}
