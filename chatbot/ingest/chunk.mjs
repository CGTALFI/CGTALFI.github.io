/**
 * Découpage structurel adaptatif du corpus ALFI (sans front-matter).
 *
 * Les fichiers viennent de PDF/OCR/bureautique : les articles ne sont PAS des
 * titres Markdown mais des lignes « Article N … » ; des repères de page
 * `<!-- p.N -->` jalonnent les fichiers issus de PDF.
 *
 * Stratégie :
 *   1. couper aux frontières fortes = début d'article OU titre Markdown ;
 *   2. re-couper les segments trop longs aux repères de page / paragraphes,
 *      en visant ~TARGET caractères (max MAX) ;
 *   3. annoter chaque chunk avec l'article détecté et la page courante.
 */
const TARGET = 1600; // taille visée d'un chunk (caractères)
const MAX = 2600; // au-delà, on force un sous-découpage

const RE_ARTICLE = /^\s*(?:#{1,6}\s*)?Article\s+[LRD]?\.?\s*[\dA-Za-z°ºªer.\-]+/;
const RE_HEADING = /^#{1,6}\s+\S/;
const RE_PAGE = /<!--\s*p\.(\d+)\s*-->/;
const RE_PAGE_G = /<!--\s*p\.(\d+)\s*-->/g;

export function chunkDocument(text) {
  const lines = text.split("\n");

  // 1. Segmentation aux frontières fortes
  const segments = [];
  let cur = [];
  const flushSeg = () => {
    if (cur.join("").trim()) segments.push(cur);
    cur = [];
  };
  for (const line of lines) {
    if ((RE_ARTICLE.test(line) || RE_HEADING.test(line)) && cur.length) flushSeg();
    cur.push(line);
  }
  flushSeg();

  // 2. Sous-découpage des segments trop longs
  const rawChunks = [];
  for (const seg of segments) {
    const t = seg.join("\n").trim();
    const pieces = t.length <= MAX ? [t] : packParagraphs(seg);
    // certaines lignes OCR portent tout un article : re-couper aux phrases
    for (const p of pieces) {
      if (p.length <= MAX) rawChunks.push(p);
      else for (const q of splitLongText(p)) rawChunks.push(q);
    }
  }

  // 3. Annotation (page courante + article détecté)
  let page = "";
  const out = [];
  for (const t of rawChunks) {
    if (!t.trim()) continue;
    const first = t.match(RE_PAGE);
    const pageForChunk = first ? first[1] : page;
    const all = [...t.matchAll(RE_PAGE_G)];
    if (all.length) page = all[all.length - 1][1];
    const art = t.match(/Article\s+[LRD]?\.?\s*[\dA-Za-z°ºªer.\-]+/);
    out.push({
      text: t,
      page: pageForChunk,
      article: art ? art[0].replace(/\s+/g, " ").trim() : "",
    });
  }
  return out;
}

// Découpe un texte trop long en paquets ≤ MAX, aux frontières de phrases.
function splitLongText(text) {
  const parts = text.split(/(?<=[.;:!?])\s+|\n+/); // phrases / retours ligne
  const out = [];
  let buf = "";
  for (const part of parts) {
    if ((buf + " " + part).length > TARGET && buf) {
      out.push(buf.trim());
      buf = part;
    } else {
      buf = buf ? buf + " " + part : part;
    }
    // garde-fou : une "phrase" seule plus longue que MAX → coupe brute
    while (buf.length > MAX) {
      out.push(buf.slice(0, MAX));
      buf = buf.slice(MAX);
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function packParagraphs(lines) {
  const out = [];
  let buf = [];
  let len = 0;
  const flush = () => {
    const t = buf.join("\n").trim();
    if (t) out.push(t);
    buf = [];
    len = 0;
  };
  for (const line of lines) {
    buf.push(line);
    len += line.length + 1;
    const breakable = line.trim() === "" || RE_PAGE.test(line);
    if ((len >= TARGET && breakable) || len >= MAX) flush();
  }
  flush();
  return out;
}
