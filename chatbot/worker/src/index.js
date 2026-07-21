/**
 * Backend RAG du chatbot documentaire CGT — Cloudflare Worker.
 *
 * Rôle : répondre à une question EXCLUSIVEMENT à partir des sources indexées
 * (convention collective, accords, code du travail) et CITER chaque source.
 *
 * Endpoints :
 *   POST /chat           { question }        → { answer, sources[] }  (public, CORS)
 *   POST /admin/ingest   { chunks[] }        → { ok, count }          (protégé par secret)
 */

// ── Réglages ────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://cgt-alfi.fr",
  "https://www.cgt-alfi.fr",
  "https://cgtalfi.github.io",
  "http://localhost:8788", // dev local
];

const EMBED_MODEL = "@cf/baai/bge-m3"; // embeddings multilingues (FR), 1024 dim
const LLM_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"; // échangeable (ex. @cf/mistralai/...)
const TOP_K = 6; // nombre d'extraits candidats
const MIN_SCORE = 0.4; // seuil de pertinence (cosine) : en-dessous → refus
const MAX_CONTEXT_CHARS = 8000; // borne de contexte envoyé au modèle
const MAX_QUESTION_LEN = 1000;

const SYSTEM_PROMPT = `Tu es l'assistant documentaire de la CGT pour les élu·es et militant·es.

RÈGLES STRICTES — à respecter impérativement :
1. Réponds EXCLUSIVEMENT à partir des EXTRAITS fournis ci-dessous. N'utilise AUCUNE connaissance extérieure.
2. Si l'information ne figure pas dans les extraits, réponds exactement : "Je n'ai pas trouvé cette information dans mes sources." et n'invente rien.
3. Pour CHAQUE affirmation, cite la source avec le numéro de l'extrait correspondant entre crochets, par exemple [1] ou [2].
4. Ne donne jamais de conseil juridique personnalisé : tes réponses sont informatives et indicatives.
5. Réponds en français, de façon claire, concise et structurée.`;

// ── Point d'entrée ──────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    const { pathname } = new URL(request.url);
    try {
      if (pathname === "/chat" && request.method === "POST") {
        return await handleChat(request, env, origin);
      }
      if (pathname === "/admin/ingest" && request.method === "POST") {
        return await handleIngest(request, env);
      }
      return json({ error: "Not found" }, 404, origin);
    } catch (err) {
      return json({ error: "Erreur interne", detail: String(err) }, 500, origin);
    }
  },
};

// ── /chat ───────────────────────────────────────────────────────────────────
async function handleChat(request, env, origin) {
  const body = await request.json().catch(() => ({}));
  const question = (body.question || "").trim();
  if (!question || question.length > MAX_QUESTION_LEN) {
    return json({ error: "Question invalide." }, 400, origin);
  }

  // 1. Embedding de la question
  const emb = await env.AI.run(EMBED_MODEL, { text: [question] });
  const vector = emb.data[0];

  // 2. Recherche des extraits les plus proches
  const res = await env.VECTORIZE.query(vector, {
    topK: TOP_K,
    returnMetadata: "all",
  });
  const matches = (res.matches || []).filter((m) => m.score >= MIN_SCORE);

  // 3. Refus si rien de pertinent (avant même d'appeler le modèle)
  if (matches.length === 0) {
    return json(
      {
        answer:
          "Je n'ai pas trouvé cette information dans mes sources (convention collective, accords, code du travail). Reformulez votre question ou rapprochez-vous d'un·e délégué·e.",
        sources: [],
      },
      200,
      origin,
    );
  }

  // 4. Construction du contexte numéroté + liste des sources
  let context = "";
  let length = 0;
  const sources = [];
  for (let i = 0; i < matches.length; i++) {
    const md = matches[i].metadata || {};
    const n = sources.length + 1;
    const block = `[${n}] ${md.titre || "Source"} — ${md.reference || ""}\n${md.texte || ""}\n\n`;
    if (length + block.length > MAX_CONTEXT_CHARS) break;
    context += block;
    length += block.length;
    sources.push({
      n,
      titre: md.titre || "",
      reference: md.reference || "",
      url: md.url || "",
      type: md.type || "",
      extrait: md.texte || "",
      score: Number(matches[i].score.toFixed(3)),
    });
  }

  // 5. Génération de la réponse sourcée
  const out = await env.AI.run(LLM_MODEL, {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `EXTRAITS :\n${context}\nQUESTION : ${question}` },
    ],
    temperature: 0.1,
    max_tokens: 800,
  });

  return json({ answer: (out.response || "").trim(), sources }, 200, origin);
}

// ── /admin/ingest (protégé) ─────────────────────────────────────────────────
async function handleIngest(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.INGEST_SECRET || auth !== `Bearer ${env.INGEST_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const chunks = body.chunks;
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return json({ error: "Aucun chunk fourni." }, 400, "");
  }

  // Embeddings du lot
  const emb = await env.AI.run(EMBED_MODEL, { text: chunks.map((c) => c.texte) });
  const vectors = emb.data.map((values, i) => ({
    id: chunks[i].id,
    values,
    metadata: {
      texte: String(chunks[i].texte || "").slice(0, 4000),
      titre: chunks[i].titre || "",
      reference: chunks[i].reference || "",
      url: chunks[i].url || "",
      type: chunks[i].type || "",
    },
  }));

  await env.VECTORIZE.upsert(vectors);
  return json({ ok: true, count: vectors.length }, 200, "");
}

// ── Utilitaires ─────────────────────────────────────────────────────────────
function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}
