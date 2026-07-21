#!/usr/bin/env node
/**
 * Petit serveur local pour TESTER le site (app + chatbot) sur votre machine.
 *
 * Pourquoi ? Le chatbot charge sa base (chatbot/search-index.json et
 * chatbot/search-code.json) via fetch(). Les navigateurs INTERDISENT fetch()
 * quand on ouvre un fichier en double-clic (protocole file://). Il faut donc
 * servir le dossier en http:// — c'est ce que fait ce script, sans rien installer.
 *
 * Utilisation :
 *   node serve-local.mjs
 * puis ouvrez l'adresse affichée (http://localhost:8080) dans votre navigateur.
 * Arrêt : Ctrl + C.
 *
 * Node >= 18. Aucune dépendance.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const ROOT = import.meta.dirname; // le dossier qui contient index.html
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(req.url.split("?")[0]);
    if (path === "/") path = "/index.html";
    // empêche de sortir du dossier servi
    const full = normalize(join(ROOT, path));
    if (!full.startsWith(ROOT)) { res.writeHead(403); return res.end("403"); }
    const buf = await readFile(full);
    res.writeHead(200, { "Content-Type": TYPES[extname(full)] || "application/octet-stream" });
    res.end(buf);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 — fichier introuvable");
  }
}).listen(PORT, () => {
  console.log(`\n  ✅ Site servi sur http://localhost:${PORT}`);
  console.log(`     Ouvrez cette adresse dans votre navigateur.`);
  console.log(`     (Ctrl + C pour arrêter)\n`);
});
