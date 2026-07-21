#!/usr/bin/env node
/**
 * Indexation du corpus CGT.
 *
 * Lit sources/**\/*.md, découpe chaque fichier en chunks (un par bloc `##`),
 * puis envoie les chunks par lots au Worker `/admin/ingest`, qui calcule les
 * embeddings et remplit Vectorize.
 *
 * Utilisation :
 *   WORKER_URL="https://cgt-chatbot.<compte>.workers.dev" \
 *   INGEST_SECRET="<le même secret que côté Worker>" \
 *   node ingest.mjs
 *
 * Aucune dépendance externe (Node >= 18).
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";

const WORKER_URL = requireEnv("WORKER_URL").replace(/\/$/, "");
const INGEST_SECRET = requireEnv("INGEST_SECRET");
const SOURCES_DIR = process.env.SOURCES_DIR || join(import.meta.dirname, "..", "sources");
const BATCH = 40; // taille de lot pour les embeddings

// ── Parcours récursif des .md ────────────────────────────────────────────────
async function listMarkdown(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listMarkdown(full)));
    else if (entry.name.endsWith(".md") && entry.name !== "FORMAT.md") out.push(full);
  }
  return out;
}

// ── Parse front-matter YAML simple (clé: valeur) ─────────────────────────────
function parseFrontMatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return { meta, body: m[2] };
}

// ── Découpe le corps en chunks : un par titre de niveau 2 (`## ...`) ─────────
function splitChunks(body) {
  const parts = body.split(/^##\s+/m); // le 1er élément = texte avant tout `##`
  const chunks = [];
  for (let i = 1; i < parts.length; i++) {
    const lines = parts[i].split("\n");
    const heading = lines.shift().trim();
    const texte = `${heading}\n${lines.join("\n")}`.trim();
    if (texte) chunks.push({ heading, texte });
  }
  return chunks;
}

function idFor(file, heading) {
  return createHash("sha1").update(`${file}::${heading}`).digest("hex").slice(0, 32);
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
const files = await listMarkdown(SOURCES_DIR);
console.log(`${files.length} fichier(s) Markdown trouvé(s).`);

const allChunks = [];
for (const file of files) {
  const rel = relative(SOURCES_DIR, file);
  const { meta, body } = parseFrontMatter(await readFile(file, "utf8"));
  const pieces = splitChunks(body);
  for (const p of pieces) {
    allChunks.push({
      id: idFor(rel, p.heading),
      texte: p.texte,
      titre: meta.titre || rel,
      reference: [meta.reference, p.heading].filter(Boolean).join(" · "),
      url: meta.url || "",
      type: meta.type || "",
    });
  }
  console.log(`  ${rel} → ${pieces.length} extrait(s)`);
}

console.log(`\nTotal : ${allChunks.length} extraits. Envoi par lots de ${BATCH}…`);
let done = 0;
for (let i = 0; i < allChunks.length; i += BATCH) {
  const res = await postBatch(allChunks.slice(i, i + BATCH));
  done += res.count || 0;
  console.log(`  ${done}/${allChunks.length} indexés`);
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
