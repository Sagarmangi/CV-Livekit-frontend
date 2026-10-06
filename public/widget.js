/*! Codeora Vision voice widget loader.
 *   <script src="https://voice.codeoravision.com/widget.js" data-key="wk_…" async></script>
 * Optional: data-position="bottom-left", data-color="#043fff", data-label="Talk to us".
 * Renders a floating launcher; the first click frames /widget/<key> from this
 * script's own host, so one file serves staging and production. No dependencies.
 */
(function () {
  "use strict";

  var script =
    document.currentScript ||
    (function () {
      var all = document.querySelectorAll('script[data-key][src*="widget.js"]');
      return all[all.length - 1];
    })();
  if (!script) return;

  var key = script.getAttribute("data-key");
  if (!key || !/^wk_[A-Za-z0-9_-]{24}$/.test(key)) {
    console.warn("[codeora-widget] data-key is missing or not a widget key");
    return;
  }
  if (window.CodeoraWidget) return; // once per page

  var origin = new URL(script.src, location.href).origin;
  var side = script.getAttribute("data-position") === "bottom-left" ? "left" : "right";
  var fixedColor = script.getAttribute("data-color");
  var fixedLabel = script.getAttribute("data-label");
  var label = fixedLabel || "";
  var HEX = /^#[0-9a-fA-F]{6}$/;

  var css =
    ".cvw{position:fixed;bottom:20px;z-index:2147483000;display:flex;flex-direction:column;gap:12px;" +
    "font:600 14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;--cvw-accent:#043fff;--cvw-size:56px}" +
    ".cvw[data-side=right]{right:20px;align-items:flex-end}.cvw[data-side=left]{left:20px;align-items:flex-start}" +
    /* Flex row, icon a fixed box: one centre line. No text, no padding: a circle. */
    ".cvw-btn{position:relative;isolation:isolate;display:flex;align-items:center;justify-content:center;gap:8px;" +
    "box-sizing:border-box;height:var(--cvw-size);min-width:var(--cvw-size);padding:0;margin:0;border:0;border-radius:999px;" +
    "background:var(--cvw-accent);color:#fff;cursor:pointer;font:inherit;line-height:1;white-space:nowrap;" +
    "box-shadow:0 8px 24px rgba(0,0,0,.18);transition:transform .15s,box-shadow .15s,background-color .15s}" +
    ".cvw-btn.cvw-has-text{padding:0 18px}" +
    ".cvw-btn:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(0,0,0,.22)}" +
    ".cvw-btn:focus-visible{outline:3px solid var(--cvw-accent);outline-offset:3px}" +
    ".cvw-btn svg{display:block;width:22px;height:22px;flex:none}" +
    ".cvw-txt{display:block;padding-top:1px}.cvw-txt:empty{display:none}" +
    ".cvw-btn .cvw-x{display:none}" +
    /* Open: a neutral dark circle with an X, so "close" never looks like "call". */
    ".cvw[data-open] .cvw-btn{background:#18181b;padding:0}" +
    ".cvw[data-open] .cvw-btn:focus-visible{outline-color:#18181b}" +
    ".cvw[data-open] .cvw-phone,.cvw[data-open] .cvw-txt,.cvw[data-open] .cvw-dot,.cvw[data-open] .cvw-btn::before{display:none}" +
    ".cvw[data-open] .cvw-x{display:block}" +
    /* In call: white dot in the pill, soft halo expanding from behind the button. */
    ".cvw-dot{display:none;width:8px;height:8px;border-radius:50%;background:#fff;flex:none;animation:cvw-blink 1.2s ease-in-out infinite}" +
    ".cvw[data-state=in_call] .cvw-dot{display:block}" +
    ".cvw[data-state=in_call] .cvw-btn::before{content:'';position:absolute;inset:0;z-index:-1;border-radius:inherit;" +
    "background:var(--cvw-accent);filter:blur(2px);animation:cvw-halo 1.6s ease-out infinite}" +
    ".cvw-panel{width:360px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 110px);" +
    "border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 24px 64px rgba(0,0,0,.24);" +
    "transform-origin:bottom;animation:cvw-in .18s ease-out}" +
    ".cvw-panel[hidden]{display:none}.cvw-panel iframe{display:block;width:100%;height:100%;border:0}" +
    "@keyframes cvw-halo{0%{transform:scale(1);opacity:.4}100%{transform:scale(1.6);opacity:0}}" +
    "@keyframes cvw-blink{0%,100%{opacity:1}50%{opacity:.35}}" +
    "@keyframes cvw-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}" +
    /* Phones: the panel takes the width, the launcher comes down a size. */
    "@media (max-width:479px){.cvw{bottom:12px;--cvw-size:52px}.cvw[data-side=right]{right:12px}.cvw[data-side=left]{left:12px}" +
    ".cvw-panel{width:calc(100vw - 24px);max-width:none;height:calc(100vh - 88px);max-height:calc(100dvh - 88px)}}" +
    "@media (prefers-reduced-motion:reduce){.cvw-btn,.cvw-panel,.cvw-dot,.cvw-btn::before{animation:none!important;transition:none!important}}";

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var root = document.createElement("div");
  root.className = "cvw";
  root.setAttribute("data-side", side);
  root.setAttribute("data-state", "idle");
  if (fixedColor && HEX.test(fixedColor)) root.style.setProperty("--cvw-accent", fixedColor);

  var panel = document.createElement("div");
  panel.className = "cvw-panel";
  panel.hidden = true;

  var button = document.createElement("button");
  button.type = "button";
  button.className = "cvw-btn";
  button.innerHTML =
    '<svg class="cvw-phone" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M3.62 6.5c1.4-1.9 3.5-3.4 6.4-4.1a1 1 0 0 1 1.1.5l1.6 3a1 1 0 0 1-.3 1.3l-2 1.4c-.3.2-.4.6-.2.9 1 1.7 2.4 3.1 4.1 4.1.3.2.7.1.9-.2l1.4-2a1 1 0 0 1 1.3-.3l3 1.6a1 1 0 0 1 .5 1.1c-.7 2.9-2.2 5-4.1 6.4a1 1 0 0 1-1.2 0C11.4 17.6 5.9 12.1 3.4 7.7a1 1 0 0 1 .2-1.2Z"/></svg>' +
    '<svg class="cvw-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
    '<span class="cvw-dot"></span><span class="cvw-txt"></span>';
  var text = button.querySelector(".cvw-txt");

  root.appendChild(panel);
  root.appendChild(button);

  var frame = null;
  var open = false;
  var state = "idle";

  // Idle shows the label, if there is one; a live call shows that it is live
  // even with the panel closed -- otherwise a visitor who collapsed it mid-call
  // has no sign the microphone is still on. "Waiting…" likewise: the widget
  // keeps polling for a free agent while collapsed and connects on its own.
  function render() {
    var txt =
      state === "in_call" ? "In call" :
      state === "waiting" ? "Waiting…" :
      state === "connecting" ? "Connecting…" :
      label;
    text.textContent = open ? "" : txt;
    button.classList.toggle("cvw-has-text", !open && txt !== "");
    root.setAttribute("data-state", state);
    button.setAttribute("aria-expanded", open ? "true" : "false");
    button.setAttribute("aria-label", open ? "Close voice assistant" : txt || "Call us");
    if (open) root.setAttribute("data-open", "");
    else root.removeAttribute("data-open");
  }

  // The iframe (and the WebRTC client) loads on first click, not page view, and
  // stays mounted once closed so collapsing the panel doesn't cut off a call.
  function show() {
    if (!frame) {
      frame = document.createElement("iframe");
      frame.src = origin + "/widget/" + key;
      frame.title = "Voice assistant";
      frame.allow = "microphone; autoplay";
      // The widget page proves which site it is on via the referrer where
      // ancestorOrigins is missing; set here so a host policy can't strip it.
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      panel.appendChild(frame);
    }
    panel.hidden = false;
    open = true;
    render();
  }

  function hide() {
    panel.hidden = true;
    open = false;
    render();
  }

  button.addEventListener("click", function () {
    if (open) hide();
    else show();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && open) hide();
  });

  window.addEventListener("message", function (event) {
    if (event.origin !== origin || !frame || event.source !== frame.contentWindow) return;
    var data = event.data;
    if (!data || data.source !== "codeora-widget") return;
    if (data.event === "close") hide();
    else if (data.event === "state" && typeof data.state === "string") {
      state = data.state;
      render();
    } else if (data.event === "theme" && !fixedColor && HEX.test(data.accent || "")) {
      root.style.setProperty("--cvw-accent", data.accent);
    }
  });

  var mounted = false;
  function mount() {
    if (mounted) return;
    mounted = true;
    render();
    if (document.body) document.body.appendChild(root);
    else document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(root); });
  }

  // The agent's colour and label, so the first paint is right rather than the
  // default. Mount waits for the answer, but briefly and never on failure: a
  // slow or refused config request must not cost the page its launcher. A
  // widget that is switched off has nothing to launch, so no button.
  var settled = false;
  function applyConfig(config) {
    if (settled) return;
    settled = true;
    if (config && config.enabled === false) return;
    if (config) {
      if (!fixedColor && HEX.test(config.accent_color || "")) root.style.setProperty("--cvw-accent", config.accent_color);
      if (!fixedLabel && typeof config.button_label === "string") label = config.button_label;
    }
    mount();
  }
  fetch(origin + "/api/widget/config?key=" + encodeURIComponent(key), { mode: "cors" })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(applyConfig, function () { applyConfig(null); });
  setTimeout(function () { applyConfig(null); }, 1500);

  window.CodeoraWidget = { open: show, close: hide, toggle: function () { (open ? hide : show)(); } };
})();
