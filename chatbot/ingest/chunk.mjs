/**
 * Découpage structurel adaptatif du corpus ALFI + code du travail + code de
 * l'environnement.
 *
 * Formats d'article gérés (frontières fortes) :
 *   - `**Article L2312-8**`  (code du travail, en gras) ;
 *   - `Article 8 En vigueur étendu …` (convention collective 3108) ;
 *   - `## ARTICLE 5 : …` (accords d'entreprise, titre Markdown) ;
 *   - `### L. 211-1` (code de l'environnement — titre Markdown SANS le mot
 *     « Article » ; identifiant déjà au format canonique avec point).
 *
 * En plus de la page (`<!-- p.N -->`), on suit le **chemin hiérarchique** issu
 * des titres Markdown (Partie › Livre › Titre › Chapitre) pour les codes,
 * afin d'obtenir une citation précise et un classement pondéré.
 *
 * Stratégie :
 *   1. couper aux frontières fortes = début d'article OU titre Markdown ;
 *   2. re-couper les segments trop longs aux repères de page / paragraphes ;
 *   3. annoter chaque chunk avec l'article détecté, la page et le chemin.
 */
const TARGET = 1600; // taille visée d'un chunk (caractères)
const MAX = 2600; // au-delà, on force un sous-découpage

// Frontière d'article : soit « Article » capitalisé (éventuellement en gras **
// ou précédé d'un titre Markdown), soit un titre pur « L./R./D. NNN » (format
// du code de l'environnement, sans le mot « Article »).
const RE_ARTICLE = /^\s*(?:#{1,6}\s*)?(?:\*\*\s*)?Article\s+[LRD]?\.?\s*\d|^\s*#{1,6}\s+[LRD]\.\s*\d/;
const RE_HEADING = /^#{1,6}\s+\S/;
const RE_PAGE = /<!--\s*p\.(\d+)\s*-->/;
const RE_PAGE_G = /<!--\s*p\.(\d+)\s*-->/g;

// Identifiant d'article normalisé pour l'affichage (« Article L. 2312-8 »).
function extractArticle(text) {
  const m = text.match(/Article\s+([LRD])\.?\s*(\d[\dA-Za-z\-]*)/);
  if (m) return "Article " + m[1].toUpperCase() + ". " + m[2];
  const n = text.match(/Article\s+(\d+(?:\s*(?:bis|ter|quater))?)/i);
  if (n) return "Article " + n[1].replace(/\s+/g, " ").trim();
  // Titre pur (code de l'environnement) : « ### L. 211-1 », pas de mot « Article ».
  const h = text.match(/^\s*#{1,6}\s+([LRD])\.\s*(\d[\dA-Za-z\-]*)/m);
  if (h) return "Article " + h[1].toUpperCase() + ". " + h[2];
  return "";
}

export function chunkDocument(text) {
  const lines = text.split("\n");

  // ── 1. Segmentation aux frontières fortes, avec suivi du chemin hiérarchique
  const stack = {}; // niveau de titre (2..6) → intitulé courant
  const RE_NOISE_HEADING = /^\s*(?:📑\s*)?Table des?\s*mati[eè]res|^\s*(?:📑\s*)?Table de navigation/i;
  const updateHeading = (line) => {
    const h = line.match(/^(#{1,6})\s+(.*\S)\s*$/);
    if (!h || RE_ARTICLE.test(line)) return; // un titre-article n'est pas de la hiérarchie
    if (RE_NOISE_HEADING.test(h[2])) return; // sommaire/table de navigation : pas de la hiérarchie légale
    const lvl = h[1].length;
    stack[lvl] = h[2].replace(/\*+/g, "").replace(/\s+/g, " ").trim();
    for (let l = lvl + 1; l <= 6; l++) delete stack[l];
  };
  const pathStr = () => {
    const parts = [];
    for (let l = 2; l <= 6; l++) if (stack[l]) parts.push(stack[l]);
    return parts.join(" › ");
  };

  const segments = [];
  let cur = [];
  let curPath = "";
  const flushSeg = () => {
    if (cur.join("").trim()) segments.push({ lines: cur, path: curPath });
    cur = [];
  };
  for (const line of lines) {
    const boundary = RE_ARTICLE.test(line) || RE_HEADING.test(line);
    if (boundary && cur.length) flushSeg();
    updateHeading(line);
    if (cur.length === 0) curPath = pathStr();
    cur.push(line);
  }
  flushSeg();

  // ── 2. Sous-découpage des segments trop longs (chemin ET article hérités :
  //      un segment = un seul article, donc les morceaux de continuation gardent
  //      le numéro d'article même s'ils ne contiennent pas la ligne « Article … »)
  const rawChunks = [];
  for (const seg of segments) {
    const t = seg.lines.join("\n").trim();
    const segArticle = extractArticle(t);
    const pieces = t.length <= MAX ? [t] : packParagraphs(seg.lines);
    for (const p of pieces) {
      if (p.length <= MAX) rawChunks.push({ text: p, path: seg.path, article: segArticle });
      else for (const q of splitLongText(p)) rawChunks.push({ text: q, path: seg.path, article: segArticle });
    }
  }

  // ── 3. Annotation (page courante, article, chemin) + rejet des titres seuls
  let page = "";
  const out = [];
  for (const rc of rawChunks) {
    const t = rc.text;
    if (!t.trim()) continue;
    const first = t.match(RE_PAGE);
    const pageForChunk = first ? first[1] : page;
    const all = [...t.matchAll(RE_PAGE_G)];
    if (all.length) page = all[all.length - 1][1];
    // ignore les chunks qui ne sont qu'un titre de structure (pas de corps)
    const nonEmpty = t.split("\n").filter((l) => l.trim());
    if (nonEmpty.length && nonEmpty.every((l) => RE_HEADING.test(l))) continue;
    out.push({
      text: t,
      page: pageForChunk,
      article: rc.article || extractArticle(t),
      path: rc.path || "",
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
