/*! Codeora Vision voice widget loader.
 *
 *   <script src="https://voice.codeoravision.com/widget.js" data-key="wk_…" async></script>
 *
 * Optional attributes: data-position="bottom-left" (default bottom-right),
 * data-color="#043fff" (overrides the agent's own accent), data-label="Talk to us".
 *
 * Renders a floating launcher; the first click inserts an iframe onto
 * /widget/<key> on the same host this script came from, so the one file
 * works on staging and production alike. No framework, no dependencies.
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
  if (!key || !/^wk_[A-Za-z0-9_-]{16,64}$/.test(key)) {
    console.warn("[codeora-widget] data-key is missing or not a widget key");
    return;
  }
  if (window.CodeoraWidget) return; // once per page

  var origin = new URL(script.src, location.href).origin;
  var side = script.getAttribute("data-position") === "bottom-left" ? "left" : "right";
  var fixedColor = script.getAttribute("data-color");
  var label = script.getAttribute("data-label") || "";

  var css =
    ".cvw{position:fixed;bottom:20px;z-index:2147483000;display:flex;flex-direction:column;gap:12px;" +
    "font:600 14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;--cvw-accent:#043fff}" +
    ".cvw[data-side=right]{right:20px;align-items:flex-end}.cvw[data-side=left]{left:20px;align-items:flex-start}" +
    ".cvw-btn{position:relative;display:inline-flex;align-items:center;gap:8px;height:56px;min-width:56px;padding:0 16px;" +
    "border:0;border-radius:999px;background:var(--cvw-accent);color:#fff;cursor:pointer;" +
    "box-shadow:0 8px 24px rgba(0,0,0,.18);transition:transform .15s,box-shadow .15s}" +
    ".cvw-btn:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(0,0,0,.22)}" +
    ".cvw-btn:focus-visible{outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 6px var(--cvw-accent)}" +
    ".cvw-btn svg{width:22px;height:22px;flex:none}.cvw-btn .cvw-x{display:none}" +
    ".cvw[data-open] .cvw-btn .cvw-mic{display:none}.cvw[data-open] .cvw-btn .cvw-x{display:block}" +
    ".cvw-txt:empty{display:none}.cvw-btn:not(:has(.cvw-txt:not(:empty))){padding:0}" +
    ".cvw[data-state=in_call] .cvw-btn::before{content:'';position:absolute;inset:-4px;border-radius:999px;" +
    "border:2px solid var(--cvw-accent);animation:cvw-pulse 1.6s ease-out infinite}" +
    ".cvw-panel{width:360px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 110px);" +
    "border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 24px 64px rgba(0,0,0,.24);" +
    "transform-origin:bottom;animation:cvw-in .18s ease-out}" +
    ".cvw-panel[hidden]{display:none}.cvw-panel iframe{display:block;width:100%;height:100%;border:0}" +
    "@keyframes cvw-pulse{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.35);opacity:0}}" +
    "@keyframes cvw-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}" +
    "@media (prefers-reduced-motion:reduce){.cvw-btn,.cvw-panel{animation:none;transition:none}.cvw-btn::before{animation:none}}";

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var root = document.createElement("div");
  root.className = "cvw";
  root.setAttribute("data-side", side);
  root.setAttribute("data-state", "idle");
  if (fixedColor) root.style.setProperty("--cvw-accent", fixedColor);

  var panel = document.createElement("div");
  panel.className = "cvw-panel";
  panel.hidden = true;

  var button = document.createElement("button");
  button.type = "button";
  button.className = "cvw-btn";
  button.setAttribute("aria-label", "Open voice assistant");
  button.setAttribute("aria-expanded", "false");
  button.innerHTML =
    '<svg class="cvw-mic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/></svg>' +
    '<svg class="cvw-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
    '<span class="cvw-txt"></span>';
  var text = button.querySelector(".cvw-txt");

  root.appendChild(panel);
  root.appendChild(button);

  var frame = null;
  var open = false;
  var state = "idle";

  // Idle shows the optional label; a live call shows that it is live, even
  // with the panel closed -- otherwise a visitor who collapsed it mid-call has
  // no sign the microphone is still on.
  function render() {
    root.setAttribute("data-state", state);
    text.textContent =
      state === "in_call" ? "In call" : state === "connecting" ? "Connecting…" : open ? "" : label;
    button.setAttribute("aria-expanded", open ? "true" : "false");
    button.setAttribute("aria-label", open ? "Close voice assistant" : "Open voice assistant");
    if (open) root.setAttribute("data-open", "");
    else root.removeAttribute("data-open");
  }

  // The iframe -- and with it the WebRTC client -- loads on the first click,
  // not on page view, and stays mounted once closed so a call in progress
  // isn't cut off by collapsing the panel.
  function show() {
    if (!frame) {
      frame = document.createElement("iframe");
      frame.src = origin + "/widget/" + key;
      frame.title = "Voice assistant";
      frame.allow = "microphone; autoplay";
      // The widget page reads its parent's origin from the referrer (where
      // ancestorOrigins isn't available) to prove which site it is on. Set
      // here so a host page's stricter referrer policy can't strip it.
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
    } else if (data.event === "theme" && !fixedColor && /^#[0-9a-fA-F]{6}$/.test(data.accent || "")) {
      root.style.setProperty("--cvw-accent", data.accent);
    }
  });

  function mount() {
    document.body.appendChild(root);
    render();
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  window.CodeoraWidget = { open: show, close: hide, toggle: function () { (open ? hide : show)(); } };
})();
