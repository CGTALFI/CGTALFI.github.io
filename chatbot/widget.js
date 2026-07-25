/**
 * Assistant documentaire CGT — widget de recherche 100 % navigateur.
 * Aucun serveur, aucune clé, aucun compte. Charge trois index (socle ALFI,
 * code du travail, code de l'environnement), recherche BM25 + re-classement
 * + accès direct par numéro d'article + synonymes/sigles. Aucune IA
 * générative → aucune invention : chaque réponse cite l'extrait exact.
 *
 * Inclus par index.html et Boite à outils du militant.html via :
 *   <script src="chatbot/widget.js" defer></script>
 * (après le bloc de config window.CGT_INDEX_URL / CGT_CODE_URL / CGT_ENV_URL)
 *
 * Voir chatbot/DEPLOIEMENT.md.
 */
/* Assistant documentaire CGT — recherche plein-texte AVANCÉE côté navigateur.
   Aucun serveur, aucune clé. Charge trois index : le socle ALFI (convention +
   accords + NAO) puis, en arrière-plan et séquentiellement, le code du travail
   et le code de l'environnement. Recherche BM25 + accès direct par numéro
   d'article + synonymes/sigles + pondération par champ. Aucune IA générative
   → aucune invention : chaque réponse cite l'extrait exact. */
(function () {
  "use strict";
  var CORE_URL = window.CGT_INDEX_URL || "chatbot/search-index.json";
  var CODE_URL = window.CGT_CODE_URL || "chatbot/search-code.json";
  var ENV_URL = window.CGT_ENV_URL || "chatbot/search-env.json";
  var RED = "#E30613";
  var DOCS = [], DF = Object.create(null), N = 0, SUMDL = 0;
  // Index secondaire doc2query (Lot 1, pilote) : BM25 sur les questions
  // reformulées associées à certains articles, fusionné par RRF avec le texte.
  var QDF = Object.create(null), QSUMDL = 0, QDOCS = [];
  var ARTMAP = Object.create(null);
  var coreState = 0, codeState = 0, envState = 0; // 0=absent 1=chargement 2=prêt
  var PENDING = null;

  // ── Styles ───────────────────────────────────────────────────────────────
  var css = ''
  + '.cgtc-fab{position:fixed;right:18px;bottom:18px;z-index:99998;width:58px;height:58px;border:none;'
  + 'border-radius:50%;background:' + RED + ';color:#fff;font-size:24px;cursor:pointer;display:none;'
  + 'align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(198,16,46,.35);transition:transform .15s}'
  + '.cgtc-fab:hover{transform:scale(1.06)}'
  + 'body.view-app .cgtc-fab{display:flex}'
  + '.cgtc-panel{position:fixed;right:18px;bottom:86px;z-index:99999;width:min(420px,calc(100vw - 24px));'
  + 'height:min(640px,calc(100vh - 120px));background:#fff;border-radius:14px;display:none;flex-direction:column;'
  + 'overflow:hidden;box-shadow:0 12px 40px rgba(26,22,19,.28);font-family:"Inter","Barlow",Arial,sans-serif}'
  + 'body.view-app .cgtc-panel.open{display:flex}'
  + '.cgtc-head{background:' + RED + ';color:#fff;padding:12px 14px;font-weight:800;display:flex;'
  + 'justify-content:space-between;align-items:center;font-family:"Barlow Condensed","Barlow",sans-serif;'
  + 'text-transform:uppercase;letter-spacing:.02em;font-size:18px}'
  + '.cgtc-head small{display:block;font-weight:500;opacity:.92;font-size:11px;text-transform:none;letter-spacing:0;font-family:"Inter",sans-serif}'
  + '.cgtc-x{background:none;border:none;color:#fff;font-size:22px;line-height:1;cursor:pointer}'
  + '.cgtc-log{flex:1;overflow-y:auto;padding:14px;background:#F6F3EE}'
  + '.cgtc-msg{margin-bottom:12px;max-width:92%;padding:10px 12px;border-radius:12px;font-size:14px;line-height:1.5}'
  + '.cgtc-user{margin-left:auto;background:' + RED + ';color:#fff;border-bottom-right-radius:3px}'
  + '.cgtc-bot{background:#fff;border:1px solid #e7e1d8;border-bottom-left-radius:3px;color:#1a1613}'
  + '.cgtc-bot strong{font-weight:700}'
  + '.cgtc-dots span{display:inline-block;width:6px;height:6px;margin:0 1px;border-radius:50%;background:#bbb;animation:cgtcb 1s infinite}'
  + '.cgtc-dots span:nth-child(2){animation-delay:.2s}.cgtc-dots span:nth-child(3){animation-delay:.4s}'
  + '@keyframes cgtcb{0%,60%,100%{opacity:.3}30%{opacity:1}}'
  + '.cgtc-res{margin-top:10px;border:1px solid #e7e1d8;border-radius:10px;padding:9px 11px;background:#fff}'
  + '.cgtc-res.exact{border-color:' + RED + ';box-shadow:0 0 0 2px rgba(227,6,19,.08)}'
  + '.cgtc-res-h{font-size:12.5px;font-weight:700;color:#222;margin-bottom:2px}'
  + '.cgtc-res-h .cgtc-n{color:' + RED + ';font-weight:800;margin-right:4px}'
  + '.cgtc-res-tag{display:inline-block;font-size:10px;text-transform:uppercase;letter-spacing:.04em;'
  + 'color:#8a7f72;border:1px solid #e0d8cc;border-radius:5px;padding:1px 5px;margin-left:6px;vertical-align:1px}'
  + '.cgtc-res-path{font-size:10.5px;color:#9a8f80;margin:1px 0 5px}'
  + '.cgtc-res-x{font-size:13px;color:#444;line-height:1.5}'
  + '.cgtc-hl{background:#ffe08a;border-radius:2px;padding:0 1px}'
  + '.cgtc-res details{margin-top:5px}.cgtc-res summary{cursor:pointer;color:' + RED + ';font-size:12px}'
  + '.cgtc-res blockquote{margin:6px 0 0;padding-left:8px;border-left:2px solid #ddd;color:#555;font-size:12px;white-space:pre-wrap}'
  + '.cgtc-foot{padding:10px;border-top:1px solid #eee;display:flex;gap:8px;background:#fff}'
  + '.cgtc-foot input{flex:1;padding:9px 11px;border:1px solid #ccc;border-radius:9px;font-size:14px;font-family:inherit}'
  + '.cgtc-foot button{background:' + RED + ';color:#fff;border:none;border-radius:9px;padding:0 14px;cursor:pointer;font-weight:700}'
  + '.cgtc-foot button:disabled{opacity:.5;cursor:default}'
  + '.cgtc-note{font-size:11px;color:#888;text-align:center;padding:0 10px 8px}'
  // aide à la recherche (axe 4)
  + '.cgtc-help{background:none;border:1px solid rgba(255,255,255,.55);color:#fff;font-size:12px;line-height:1;'
  + 'cursor:pointer;border-radius:50%;width:20px;height:20px;margin-right:8px;padding:0;font-weight:700}'
  + '.cgtc-help:hover{background:rgba(255,255,255,.18)}'
  + '.cgtc-tips{margin:6px 0 8px;padding-left:18px;font-size:13px;color:#444}'
  + '.cgtc-tips li{margin-bottom:3px}'
  + '.cgtc-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}'
  + '.cgtc-chip{background:#fff;border:1px solid ' + RED + ';color:' + RED + ';border-radius:14px;'
  + 'padding:4px 10px;font-size:12px;cursor:pointer;font-family:inherit}'
  + '.cgtc-chip:hover{background:' + RED + ';color:#fff}';
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ── DOM ──────────────────────────────────────────────────────────────────
  var fab = el("button", "cgtc-fab", "🔍");
  fab.setAttribute("aria-label", "Ouvrir l'assistant documentaire CGT");
  var panel = el("div", "cgtc-panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Assistant documentaire CGT");
  panel.innerHTML =
    '<div class="cgtc-head"><span>Assistant CGT<small>Code du travail · convention · accords — sources exactes</small></span>' +
    '<span><button class="cgtc-help" aria-label="Comment bien chercher" title="Comment bien chercher">?</button>' +
    '<button class="cgtc-x" aria-label="Fermer">×</button></span></div>' +
    '<div class="cgtc-log"></div>' +
    '<div class="cgtc-foot"><input type="text" placeholder="Question ou n° d\'article (ex. L2312-8)…" aria-label="Votre question"><button>Chercher</button></div>' +
    '<div class="cgtc-note">Informations indicatives — ne remplacent pas l\'avis d\'un·e délégué·e.</div>';
  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var log = panel.querySelector(".cgtc-log");
  var input = panel.querySelector("input");
  var send = panel.querySelector(".cgtc-foot button");

  // ── Aide à la recherche (axe 4) ───────────────────────────────────────────
  var EXEMPLES = ["L2312-8", "heures de délégation CSE", "congé décès", "temps de pause", "déchets dangereux"];
  function astucesHtml() {
    return "**Pour trouver plus vite :**"
      + '<ul class="cgtc-tips">'
      + "<li>Un <b>numéro d’article</b> (L2312-8, L.211-1) → l’article exact.</li>"
      + "<li>Des <b>mots-clés précis</b> plutôt qu’une longue phrase : « congé décès » marche mieux que « combien de jours quand un proche meurt ».</li>"
      + "<li>Les <b>sigles</b> sont compris : CSE, CSSCT, DUERP, DGI, VIP, RPS, SMIC…</li>"
      + "</ul>"
      + '<div class="cgtc-chips">' + EXEMPLES.map(function (e) {
        return '<button class="cgtc-chip" data-q="' + escapeAttr(e) + '">' + escapeHtml(e) + "</button>";
      }).join("") + "</div>";
  }
  // Délégation de clic sur les chips (les messages sont injectés dynamiquement).
  log.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".cgtc-chip") : null;
    if (!b) return;
    input.value = b.getAttribute("data-q");
    ask();
  });
  panel.querySelector(".cgtc-help").onclick = function () { botMsg(astucesHtml()); };

  fab.onclick = function () {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) {
      if (!log.childNodes.length)
        botMsg("Bonjour 👋 Je cherche dans le code du travail, le code de l’environnement, la convention collective et les accords — et je **cite l’extrait exact**, je n’invente rien.<br><br>" + astucesHtml());
      loadCore();
      input.focus();
    }
  };
  panel.querySelector(".cgtc-x").onclick = function () { panel.classList.remove("open"); };
  send.onclick = ask;
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") ask(); });

  // ── Chargement des index : socle immédiat, puis code du travail et code de
  //    l'environnement en arrière-plan, SÉQUENTIELLEMENT (pas simultanément,
  //    pour ne pas saturer une connexion mobile) ────────────────────────────
  function loadCore() {
    if (coreState) return;
    coreState = 1;
    var loading = append("cgtc-bot", 'Chargement de la base documentaire… <span class="cgtc-dots"><span></span><span></span><span></span></span>');
    fetch(CORE_URL)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        addDocs(data.docs || []);
        coreState = 2;
        loading.remove();
        botMsg("Base prête : **" + DOCS.length + "** extraits (convention, accords, NAO). Le code du travail et le code de l'environnement se chargent en arrière-plan…");
        loadCode();
        if (PENDING) { var q = PENDING; PENDING = null; run(q); }
      })
      .catch(function () {
        loading.remove(); coreState = 0;
        botMsg("⚠️ Impossible de charger la base documentaire (" + escapeHtml(CORE_URL) + ").");
      });
  }
  function loadCode() {
    if (codeState) return;
    codeState = 1;
    fetch(CODE_URL)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var before = DOCS.length;
        addDocs(data.docs || []);
        codeState = 2;
        botMsg("✅ Code du travail chargé (**" + (DOCS.length - before) + "** articles). Chargement du code de l'environnement…");
        loadEnv();
      })
      .catch(function () { codeState = 0; /* le socle reste opérationnel */ });
  }
  function loadEnv() {
    if (envState) return;
    envState = 1;
    fetch(ENV_URL)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var before = DOCS.length;
        addDocs(data.docs || []);
        envState = 2;
        botMsg("✅ Code de l'environnement chargé (**" + (DOCS.length - before) + "** articles) — recherche complète (convention, accords, NAO, code du travail, code de l'environnement).");
      })
      .catch(function () { envState = 0; /* le socle + code du travail restent opérationnels */ });
  }

  // Indexe un lot de documents (tokenise le corps, met à jour DF, avgdl, ARTMAP).
  function addDocs(docs) {
    for (var i = 0; i < docs.length; i++) {
      var d = docs[i];
      var toks = tokenize(d.x);
      var tf = Object.create(null);
      for (var j = 0; j < toks.length; j++) tf[toks[j]] = (tf[toks[j]] || 0) + 1;
      d._tf = tf; d._len = toks.length; SUMDL += toks.length;
      for (var t in tf) DF[t] = (DF[t] || 0) + 1;
      // tokens « de champ » (référence, chemin, titre) pour la pondération
      var bt = Object.create(null);
      tokenize((d.r || "") + " " + (d.h || "") + " " + (d.t || "")).forEach(function (w) { bt[w] = 1; });
      d._bt = bt;
      // clé d'article pour l'accès direct
      var ak = artKey(d.r);
      if (ak) { d._ak = ak; (ARTMAP[ak] = ARTMAP[ak] || []).push(DOCS.length); }
      // doc2query (Lot 1) : index secondaire sur les questions reformulées
      if (d.q && d.q.length) {
        var qtoks = tokenize(d.q.join(" "));
        var qtf = Object.create(null);
        for (var qi = 0; qi < qtoks.length; qi++) qtf[qtoks[qi]] = (qtf[qtoks[qi]] || 0) + 1;
        d._qtf = qtf; d._qlen = qtoks.length; QSUMDL += qtoks.length;
        for (var qt in qtf) QDF[qt] = (QDF[qt] || 0) + 1;
        QDOCS.push(DOCS.length);
      }
      DOCS.push(d);
    }
    N = DOCS.length;
  }

  // ── Recherche ─────────────────────────────────────────────────────────────
  function ask() {
    var q = input.value.trim();
    if (!q) return;
    userMsg(q);
    input.value = "";
    if (coreState !== 2) { PENDING = q; loadCore(); return; }
    run(q);
  }

  function run(q) {
    var avgdl = SUMDL / (N || 1), k1 = 1.5, b = 0.75, BOOST = 0.3;
    // 1. Accès direct par numéro d'article (L./R./D. …)
    var exact = [];
    articleKeys(q).forEach(function (key) {
      (ARTMAP[key] || []).forEach(function (i) { if (exact.indexOf(i) === -1) exact.push(i); });
    });
    // 2. Termes pondérés : saisis = 1, synonymes/sigles = 0.5 (recall sans nuire à la précision)
    var orig = uniq(tokenize(q));
    var wmap = Object.create(null);
    orig.forEach(function (t) { wmap[t] = 1; });
    orig.forEach(function (t) { (SYN[t] || []).forEach(function (w) { if (wmap[w] == null) wmap[w] = 0.5; }); });
    var present = Object.keys(wmap).filter(function (t) { return DF[t]; });
    var REFUSE = "Je n’ai pas trouvé cette information dans mes sources.<br><br>" + astucesHtml()
      + '<div style="margin-top:8px;font-size:12.5px;color:#666">Si la réponse n’y est pas, rapprochez-vous d’un·e délégué·e.</div>';
    if (!exact.length && !present.length) { botMsg(REFUSE); return; }
    // 3. Étape 1 — rappel BM25 (+ bonus de champ) et couverture (garde-fou anti-bruit)
    var scored = [], maxCov = 0;
    for (var i = 0; i < DOCS.length; i++) {
      if (exact.indexOf(i) !== -1) continue;
      var d = DOCS[i], s = 0;
      for (var k = 0; k < present.length; k++) {
        var term = present[k], wt = wmap[term], idf = Math.log(1 + (N - DF[term] + 0.5) / (DF[term] + 0.5));
        var f = d._tf[term];
        if (f) s += wt * idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d._len / avgdl));
        if (d._bt[term]) s += wt * idf * BOOST; // bonus référence/chemin/titre
      }
      if (s > 0) {
        scored.push([s, i]);
        var cov = 0;
        for (var o = 0; o < orig.length; o++) if (covers(d, orig[o])) cov++;
        if (cov > maxCov) maxCov = cov;
      }
    }
    scored.sort(function (a, b2) { return b2[0] - a[0]; });
    // Garde-fou : sans article exact, au moins 2 termes distincts (synonymes inclus)
    // doivent co-occurrer dans un même extrait — sinon probablement hors-sujet.
    if (!exact.length) {
      if (!scored.length || (orig.length >= 2 && maxCov < 2)) { botMsg(REFUSE); return; }
    }
    // 3bis. Liste B — BM25 sur les questions doc2query (Lot 1, pilote), puis
    // fusion RRF (Reciprocal Rank Fusion, sans poids à régler) avec la liste A
    // (texte). Comble l'écart de vocabulaire sans toucher au garde-fou anti-bruit
    // (calculé sur la liste A seule, ci-dessus).
    var scoredQ = [];
    if (QDOCS.length && present.length) {
      var qavgdl = QSUMDL / QDOCS.length;
      for (var qd = 0; qd < QDOCS.length; qd++) {
        var qi2 = QDOCS[qd];
        if (exact.indexOf(qi2) !== -1) continue;
        var d2 = DOCS[qi2], s2 = 0;
        for (var k2 = 0; k2 < present.length; k2++) {
          var term2 = present[k2], f2 = d2._qtf[term2];
          if (!f2) continue;
          var idf2 = Math.log(1 + (QDOCS.length - QDF[term2] + 0.5) / (QDF[term2] + 0.5));
          s2 += wmap[term2] * idf2 * (f2 * (k1 + 1)) / (f2 + k1 * (1 - b + b * d2._qlen / qavgdl));
        }
        if (s2 > 0) scoredQ.push([s2, qi2]);
      }
      scoredQ.sort(function (a, b3) { return b3[0] - a[0]; });
    }
    var RRF_K = 60;
    var rrf = Object.create(null);
    for (var ra = 0; ra < scored.length; ra++) { var di = scored[ra][1]; rrf[di] = (rrf[di] || 0) + 1 / (RRF_K + ra + 1); }
    for (var rb = 0; rb < scoredQ.length; rb++) { var dj = scoredQ[rb][1]; rrf[dj] = (rrf[dj] || 0) + 1 / (RRF_K + rb + 1); }
    var fused = Object.keys(rrf).map(function (k4) { return [rrf[k4], +k4]; });
    fused.sort(function (a, b4) { return b4[0] - a[0]; });
    // score BM25 d'origine (liste A si présent, sinon liste B) conservé pour le rerank
    var bm25ById = Object.create(null);
    scored.forEach(function (p) { bm25ById[p[1]] = p[0]; });
    scoredQ.forEach(function (p) { if (bm25ById[p[1]] == null) bm25ById[p[1]] = p[0]; });

    // 4. Étape 2 — re-classement des 50 meilleurs (phrase, proximité, couverture, champ)
    var topc = fused.slice(0, 50).map(function (p) { return [bm25ById[p[1]], p[1]]; });
    var maxb = topc.length ? Math.max.apply(null, topc.map(function (p) { return p[0]; })) || 1 : 1;
    var reranked = topc.map(function (p) { return [rerankScore(DOCS[p[1]], orig, p[0] / maxb), p[1]]; });
    reranked.sort(function (a, b2) { return b2[0] - a[0]; });
    var order = exact.concat(reranked.map(function (p) { return p[1]; }));
    var seen = Object.create(null), uni = [];
    for (var z = 0; z < order.length && uni.length < 6; z++) if (!seen[order[z]]) { seen[order[z]] = 1; uni.push(order[z]); }
    order = uni;
    if (!order.length) { botMsg(REFUSE); return; }
    // 5. Rendu (accroche adaptée à l'intention + extraits nettoyés/lisibles)
    var qset = Object.create(null); Object.keys(wmap).forEach(function (w) { qset[w] = 1; });
    var html = leadIn(intentOf(q), exact.length, DOCS[order[0]], orig);
    for (var r = 0; r < order.length; r++) {
      var doc = DOCS[order[r]], n = r + 1, isExact = exact.indexOf(order[r]) !== -1;
      var ref = doc.r || (doc.p ? "p." + doc.p : "");
      if (!ref && doc.h) { var seg = doc.h.split(" › "); ref = seg[seg.length - 1]; } // repli : dernier niveau du chemin
      if (doc.p && ref.indexOf("p." + doc.p) === -1) ref += (ref ? " · " : "") + "p." + doc.p;
      var isCode = doc.ty === "code_du_travail" || doc.ty === "code_environnement";
      var head = isCode
        ? escapeHtml(ref) + " — " + escapeHtml(doc.t)
        : escapeHtml(doc.t) + (ref ? " — " + escapeHtml(ref) : "");
      var body = cleanExcerpt(doc.x);
      html += '<div class="cgtc-res' + (isExact ? ' exact' : '') + '"><div class="cgtc-res-h"><span class="cgtc-n">[' + n + ']</span>' + head
        + '<span class="cgtc-res-tag">' + escapeHtml(typeLabel(doc.ty)) + '</span></div>'
        + (doc.h ? '<div class="cgtc-res-path">' + escapeHtml(doc.h) + '</div>' : '')
        + '<div class="cgtc-res-x">' + renderExcerpt(highlight(escapeHtml(bestWindow(body, qset)), qset)) + '</div>'
        + '<details><summary>Voir l’extrait complet</summary><blockquote>' + renderExcerpt(highlight(escapeHtml(body), qset)) + '</blockquote></details>'
        // chemin de fichier : utile pour identifier un accord, redondant pour les codes
        + (isCode ? '' : '<div style="font-size:10.5px;color:#aaa;margin-top:4px">' + escapeHtml(doc.s) + '</div>')
        + '</div>';
    }
    botMsg(html);
  }

  // ── Compréhension de la demande (axe 1) ───────────────────────────────────
  // Sert UNIQUEMENT à rédiger l'accroche : n'influence ni la recherche ni le
  // contenu (qui reste strictement extractif).
  function intentOf(q) {
    var f = fold(q);
    if (articleKeys(q).length) return "article";
    if (/\b(combien|quel(le)?s? (duree|delai|montant|taux|nombre)|nombre de|montant|nb )/.test(f)) return "quantite";
    if (/\b(ai[- ]je le droit|a[- ]t[- ]on droit|puis[- ]je|peut[- ]il|peut[- ]elle|a le droit|est[- ]ce (que je peux|legal|autorise))/.test(f)) return "droit";
    if (/\b(comment|quelle (procedure|demarche)|demarche|procedure|que faire)/.test(f)) return "procedure";
    if (/\b(qu.est[- ]ce|c.est quoi|definition|ca veut dire|signifie)/.test(f)) return "definition";
    return "general";
  }
  // Accroche : encadre le résultat sans jamais énoncer de règle de droit.
  function leadIn(intent, exactCount, topDoc, orig) {
    if (exactCount) return "Voici l’article demandé :";
    var mots = orig.slice(0, 3).join(", ");
    switch (intent) {
      case "quantite": return "La valeur exacte figure dans l’extrait ci-dessous — **lisez le texte, je ne le résume pas** :";
      case "droit": return "Voici ce que disent les textes sur ce point. **À vérifier avec un·e délégué·e pour votre situation.**";
      case "procedure": return "Voici les textes qui décrivent la marche à suivre :";
      case "definition": return "Voici la définition telle qu’elle figure dans les textes :";
      default: return mots ? "Passages les plus pertinents sur « " + escapeHtml(mots) + " » :" : "Passages les plus pertinents :";
    }
  }

  // ── Présentation des extraits (axe 3) ─────────────────────────────────────
  // Retire l'en-tête d'article Markdown (déjà affiché dans le titre de la carte)
  // et les marqueurs résiduels, sans toucher au texte de fond.
  function cleanExcerpt(t) {
    return String(t)
      .replace(/^\s*#{1,6}\s*\**\s*Article\s+[LRD]?\.?\s*[\dA-Za-z.\-]+\s*\**\s*:?\s*/i, "")
      .replace(/^\s*\*\*\s*Article\s+[LRD]?\.?\s*[\dA-Za-z.\-]+\s*\*\*\s*/i, "")
      .replace(/^\s*#{1,6}\s+[LRD]\.\s*[\dA-Za-z.\-]+\s*/i, "")
      .replace(/^\s*Article\s+\d+[a-z]*\s+En vigueur[^\n]*\n?/i, "")
      .replace(/^\s*#{1,6}\s+/gm, "")
      .trim();
  }
  // Fenêtre d'extrait qui MAXIMISE le nombre de termes de la requête (au lieu de
  // la première occurrence) — l'extrait ressemble davantage à une réponse.
  function bestWindow(text, qset) {
    var W = 340, folded = fold(text), hits = [], re = /[a-z0-9]+/g, m;
    while ((m = re.exec(folded))) if (qset[stem(m[0])]) hits.push(m.index);
    if (!hits.length) return text.slice(0, W) + (text.length > W ? "…" : "");
    var bestStart = hits[0], bestCount = 0;
    for (var i = 0; i < hits.length; i++) {
      var start = Math.max(0, hits[i] - 60), c = 0;
      for (var j = 0; j < hits.length; j++) if (hits[j] >= start && hits[j] < start + W) c++;
      if (c > bestCount) { bestCount = c; bestStart = start; }
    }
    var end = Math.min(text.length, bestStart + W);
    return (bestStart > 0 ? "…" : "") + text.slice(bestStart, end).trim() + (end < text.length ? "…" : "");
  }
  // Rendu lisible : retours ligne + mise en retrait des énumérations légales.
  function renderExcerpt(escaped) {
    return escaped
      .replace(/\n\s*(\d+°|[a-z]\)|[IVX]+\.[-–]?)/g, '<br><span style="display:inline-block;width:10px"></span>$1')
      .replace(/\n/g, "<br>");
  }

  // ── Numéros d'article ─────────────────────────────────────────────────────
  function articleKeys(q) {
    var keys = [], re = /\b([LRD])\.?\s*(\d[\d]*(?:-\d+)*)/gi, m;
    while ((m = re.exec(q))) keys.push((m[1] + m[2]).toUpperCase().replace(/\s+/g, ""));
    return keys;
  }
  function artKey(r) {
    var m = /Article\s+([LRD])\.?\s*(\d[\dA-Za-z-]*)/i.exec(r || "");
    return m ? (m[1] + m[2]).toUpperCase().replace(/\s+/g, "") : "";
  }
  // Un terme est « couvert » par un doc s'il y figure directement ou via un synonyme.
  function has(d, t) { return !!(d._tf[t] || d._bt[t]); }
  function covers(d, t) {
    if (has(d, t)) return true;
    var syn = SYN[t];
    if (syn) for (var i = 0; i < syn.length; i++) if (has(d, syn[i])) return true;
    return false;
  }

  // ── Re-classement (étape 2) — poids réglés par banc d'évaluation ───────────
  // Plus petite fenêtre (en tokens) couvrant un terme de chaque liste de positions.
  function smallestWindow(lists) {
    if (lists.length < 2) return Infinity;
    var ptr = lists.map(function () { return 0; }), best = Infinity;
    while (true) {
      var mn = Infinity, mnI = -1, mx = -Infinity;
      for (var i = 0; i < lists.length; i++) { var v = lists[i][ptr[i]]; if (v < mn) { mn = v; mnI = i; } if (v > mx) mx = v; }
      if (mx - mn < best) best = mx - mn;
      if (++ptr[mnI] >= lists[mnI].length) break;
    }
    return best;
  }
  // Score combiné : BM25 normalisé + phrase (adjacence) + proximité + couverture + champ + article.
  function rerankScore(d, orig, bm25n) {
    var toks = tokenize(d.x), cov = 0, fld = 0, qcov = 0, posLists = [];
    for (var a = 0; a < orig.length; a++) {
      var t = orig[a], pos = [];
      for (var i = 0; i < toks.length; i++) if (toks[i] === t) pos.push(i);
      var inField = d._bt[t] === 1;
      var inQ = !!(d._qtf && d._qtf[t] > 0); // doc2query (Lot 1) : crédit même si le
      if (pos.length || inField || inQ) cov++; // terme n'apparaît pas littéralement
      if (inField) fld++;                       // dans le texte de l'article (pont
      if (inQ) qcov++;                           // de vocabulaire).
      if (pos.length) posLists.push(pos);
    }
    var covR = orig.length ? cov / orig.length : 0, fldR = orig.length ? fld / orig.length : 0;
    var qcovR = orig.length ? qcov / orig.length : 0, prox = 0;
    if (posLists.length >= 2) { var win = smallestWindow(posLists); prox = 1 / (1 + Math.max(0, win - (posLists.length - 1))); }
    var phrase = 0;
    if (orig.length >= 2) {
      var adj = 0;
      for (var k = 0; k < orig.length - 1; k++)
        for (var p = 0; p < toks.length - 1; p++) if (toks[p] === orig[k] && toks[p + 1] === orig[k + 1]) { adj++; break; }
      phrase = adj / (orig.length - 1);
    }
    var subst = /Article\s+[LRD0-9]/.test(d.r || "") ? 1 : 0;
    return bm25n + 3 * phrase + prox + 2 * covR + 0.5 * fldR + 6 * qcovR + 0.3 * subst;
  }

  // ── Traitement du texte ───────────────────────────────────────────────────
  var STOP = words("le la les un une des du de d l au aux et ou en dans par pour sur sous avec sans ce cet cette ces son sa ses leur leurs il elle ils elles on nous vous je tu que qui quoi dont ou est sont etre avoir fait plus moins ne pas ni car donc mais comme si quel quelle quels quelles se mon ton a the of to combien quel quels");
  // Synonymes / sigles → formes normalisées (déjà foldées/stemmées).
  var SYN = {
    cse: ["comite", "social", "economique"], cssct: ["sante", "securite", "conditions"],
    chsct: ["cssct", "sante", "securite"], dp: ["delegue", "personnel"], dup: ["delegue", "unique"],
    rtt: ["reduction", "temps", "travail"], nao: ["negociation", "annuelle", "obligatoire"],
    duerp: ["document", "unique"], duer: ["document", "unique"], irp: ["representant", "personnel"],
    cdd: ["duree", "determinee", "determine"], cdi: ["duree", "indeterminee", "indetermine"],
    ppv: ["prime", "partage", "valeur"], pee: ["plan", "epargne"], dgi: ["danger", "grave", "imminent"],
    at: ["accident", "travail"], mp: ["maladie", "professionnelle"], ij: ["indemnite", "journaliere"],
    smic: ["salaire", "minimum", "croissance"], remuneration: ["salaire"], salaire: ["remuneration"],
    embauche: ["recrutement"], maternite: ["naissance", "enfant"], paternite: ["naissance", "enfant"],
    harcelement: ["agissement"], vip: ["visite", "information", "prevention"],
    rps: ["risques", "psychosociaux"], tms: ["troubles", "musculosquelettiques"],
    delegation: ["heures", "delegation"], deces: ["evenements", "familiaux"],

    // ── Registre courant/familier → vocabulaire légal (Lot 1.8) ──────────────
    // Les militants n'écrivent pas comme le législateur. Ces termes sont pour la
    // plupart ABSENTS du corpus (donc aujourd'hui purement inutiles dans une
    // requête) : les mapper est un gain sans risque de dégrader l'existant.
    bosser: ["travail"], boulot: ["travail"], taf: ["travail"], turbin: ["travail"],
    vire: ["licenciement", "licencie"], virer: ["licenciement", "licencie"],
    patron: ["employeur"], boss: ["employeur"], dirlo: ["employeur"],
    fric: ["salaire", "remuneration"], thune: ["salaire", "remuneration"],
    paye: ["salaire", "remuneration"], oseille: ["salaire"],
    rab: ["supplementaire", "heure"], rabe: ["supplementaire", "heure"],
    humilie: ["harcelement", "agissement"], rabaisse: ["harcelement", "agissement"],
    engueule: ["harcelement", "agissement"], brime: ["harcelement", "agissement"],
    papier: ["document"], paperasse: ["document"],
    amiable: ["conventionnelle", "rupture"], prevenance: ["preavis"],
    collegue: ["salarie", "travailleur"], debrayage: ["greve"],
    syndicat: ["syndical"], arnaque: ["irregulier"],
  };
  function expand(toks) {
    var out = toks.slice();
    toks.forEach(function (t) { if (SYN[t]) SYN[t].forEach(function (w) { if (out.indexOf(w) === -1) out.push(w); }); });
    return out;
  }
  function fold(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function stem(w) { return w.length > 4 ? w.replace(/(aux|eaux|s|x)$/, "") : w; }
  function tokenize(s) {
    var raw = fold(s).split(/[^a-z0-9]+/), out = [];
    for (var i = 0; i < raw.length; i++) { var w = raw[i]; if (w.length < 2 || STOP[w]) continue; out.push(stem(w)); }
    return out;
  }
  function snippet(text, qset) {
    var folded = fold(text), pos = -1, re = /[a-z0-9]+/g, m;
    while ((m = re.exec(folded))) { if (qset[stem(m[0])]) { pos = m.index; break; } }
    if (pos < 0) pos = 0;
    var start = Math.max(0, pos - 110), end = Math.min(text.length, pos + 250);
    return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
  }
  function highlight(escaped, qset) {
    return escaped.replace(/[A-Za-zÀ-ſ0-9]+/g, function (w) { return qset[stem(fold(w))] ? '<mark class="cgtc-hl">' + w + "</mark>" : w; });
  }
  function typeLabel(t) {
    return t === "convention_collective" ? "Convention" : t === "code_du_travail" ? "Code du travail" : t === "code_environnement" ? "Code environnement" : t === "nao" ? "NAO" : "Accord";
  }

  // ── Rendu / helpers ───────────────────────────────────────────────────────
  function userMsg(text) { return append("cgtc-user", escapeHtml(text)); }
  function botMsg(html) { return append("cgtc-bot", renderMd(html)); }
  function append(cls, html) {
    var d = el("div", "cgtc-msg " + cls);
    d.innerHTML = html;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function renderMd(t) { return String(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }
  function words(s) { var o = Object.create(null); s.split(/\s+/).forEach(function (w) { if (w) o[w] = 1; }); return o; }
  function uniq(a) { var o = Object.create(null), out = []; a.forEach(function (w) { if (!o[w]) { o[w] = 1; out.push(w); } }); return out; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
  function escapeHtml(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }
})();
