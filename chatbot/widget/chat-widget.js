/**
 * Widget de chat documentaire CGT — à intégrer dans l'app "Boîte à outils".
 *
 * Intégration (Phase 6) : déposer ce fichier à la racine du site puis ajouter,
 * juste avant </body> dans index.html :
 *
 *   <script>window.CGT_CHATBOT_URL = "https://cgt-chatbot.<compte>.workers.dev";</script>
 *   <script src="chatbot/widget/chat-widget.js" defer></script>
 *
 * Le widget est autonome (crée son style + son DOM), sans dépendance.
 */
(function () {
  "use strict";
  var API = (window.CGT_CHATBOT_URL || "").replace(/\/$/, "");
  var RED = "#E30613";

  // ── Styles ──────────────────────────────────────────────────────────────
  var css = `
  .cgtc-fab{position:fixed;right:18px;bottom:18px;z-index:99998;width:58px;height:58px;border:none;border-radius:50%;
    background:${RED};color:#fff;font-size:26px;cursor:pointer;box-shadow:0 6px 20px rgba(198,16,46,.35)}
  .cgtc-panel{position:fixed;right:18px;bottom:86px;z-index:99999;width:min(400px,calc(100vw - 24px));
    height:min(620px,calc(100vh - 120px));background:#fff;border-radius:14px;display:none;flex-direction:column;
    overflow:hidden;box-shadow:0 12px 40px rgba(26,22,19,.28);font-family:"Inter","Barlow",Arial,sans-serif}
  .cgtc-panel.open{display:flex}
  .cgtc-head{background:${RED};color:#fff;padding:12px 14px;font-weight:800;display:flex;justify-content:space-between;align-items:center}
  .cgtc-head small{display:block;font-weight:500;opacity:.9;font-size:11px}
  .cgtc-x{background:none;border:none;color:#fff;font-size:20px;cursor:pointer}
  .cgtc-log{flex:1;overflow-y:auto;padding:14px;background:#F6F3EE}
  .cgtc-msg{margin-bottom:12px;max-width:90%;padding:10px 12px;border-radius:12px;font-size:14px;line-height:1.5;white-space:pre-wrap}
  .cgtc-user{margin-left:auto;background:${RED};color:#fff;border-bottom-right-radius:3px}
  .cgtc-bot{background:#fff;border:1px solid #e7e1d8;border-bottom-left-radius:3px}
  .cgtc-src{margin-top:8px;font-size:12.5px;border-top:1px dashed #d9d2c7;padding-top:6px}
  .cgtc-src b{display:block;margin-bottom:3px;color:#555}
  .cgtc-src a{color:${RED};text-decoration:none}
  .cgtc-src a:hover{text-decoration:underline}
  .cgtc-src details{margin:3px 0}
  .cgtc-src summary{cursor:pointer;color:#333}
  .cgtc-src blockquote{margin:4px 0 6px;padding-left:8px;border-left:2px solid #ddd;color:#555;font-size:12px}
  .cgtc-foot{padding:10px;border-top:1px solid #eee;display:flex;gap:8px;background:#fff}
  .cgtc-foot input{flex:1;padding:9px 11px;border:1px solid #ccc;border-radius:9px;font-size:14px}
  .cgtc-foot button{background:${RED};color:#fff;border:none;border-radius:9px;padding:0 14px;cursor:pointer;font-weight:700}
  .cgtc-foot button:disabled{opacity:.5;cursor:default}
  .cgtc-note{font-size:11px;color:#888;text-align:center;padding:0 10px 8px}`;
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ── DOM ─────────────────────────────────────────────────────────────────
  var fab = el("button", "cgtc-fab", "💬");
  fab.setAttribute("aria-label", "Ouvrir l'assistant documentaire");
  var panel = el("div", "cgtc-panel");
  panel.innerHTML =
    '<div class="cgtc-head"><span>Assistant CGT<small>Réponses sourcées · convention, accords, code du travail</small></span>' +
    '<button class="cgtc-x" aria-label="Fermer">×</button></div>' +
    '<div class="cgtc-log"></div>' +
    '<div class="cgtc-foot"><input type="text" placeholder="Votre question…" aria-label="Votre question"><button>Envoyer</button></div>' +
    '<div class="cgtc-note">Informations indicatives — ne remplacent pas l\'avis d\'un·e délégué·e.</div>';
  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var log = panel.querySelector(".cgtc-log");
  var input = panel.querySelector("input");
  var send = panel.querySelector(".cgtc-foot button");

  fab.onclick = function () {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) {
      if (!log.childNodes.length) botMsg("Bonjour 👋 Posez votre question sur vos droits. Je réponds uniquement à partir des textes et je cite mes sources.", []);
      input.focus();
    }
  };
  panel.querySelector(".cgtc-x").onclick = function () { panel.classList.remove("open"); };
  send.onclick = ask;
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") ask(); });

  // ── Échange ─────────────────────────────────────────────────────────────
  function ask() {
    var q = input.value.trim();
    if (!q) return;
    if (!API) { botMsg("⚠️ Configuration manquante : window.CGT_CHATBOT_URL n'est pas défini.", []); return; }
    userMsg(q);
    input.value = "";
    setBusy(true);
    var thinking = botMsg("…", []);
    fetch(API + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        thinking.remove();
        botMsg(data.answer || "Aucune réponse.", data.sources || []);
      })
      .catch(function () {
        thinking.remove();
        botMsg("⚠️ Erreur de connexion à l'assistant. Réessayez plus tard.", []);
      })
      .finally(function () { setBusy(false); });
  }

  function setBusy(b) { send.disabled = b; input.disabled = b; }

  // ── Rendu des messages ──────────────────────────────────────────────────
  function userMsg(text) { return append("cgtc-user", escapeHtml(text)); }

  function botMsg(text, sources) {
    var html = renderMarkdown(text);
    if (sources && sources.length) {
      html += '<div class="cgtc-src"><b>Sources</b>';
      sources.forEach(function (s) {
        var ref = s.reference || "";
        if (s.page && ref.indexOf("p." + s.page) === -1) ref += (ref ? " · " : "") + "p." + s.page;
        var label = escapeHtml((s.titre || "Source") + (ref ? " — " + ref : ""));
        var link = s.url ? '<a href="' + escapeAttr(s.url) + '" target="_blank" rel="noopener">' + label + "</a>" : label;
        html += "<details><summary>[" + s.n + "] " + link + "</summary>";
        if (s.extrait) html += "<blockquote>" + escapeHtml(s.extrait).slice(0, 600) + "</blockquote>";
        html += "</details>";
      });
      html += "</div>";
    }
    return append("cgtc-bot", html);
  }

  function append(cls, html) {
    var d = el("div", "cgtc-msg " + cls);
    d.innerHTML = html;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  function renderMarkdown(t) {
    return escapeHtml(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^- (.+)$/gm, "• $1")
      .replace(/\[(\d+)\]/g, '<sup style="color:' + RED + '">[$1]</sup>')
      .replace(/\n/g, "<br>");
  }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
  function escapeHtml(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }
})();
