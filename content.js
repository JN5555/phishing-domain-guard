// Hlídá, jestli se na stránce objeví pole pro heslo, a případně zobrazí varovný pruh.
(() => {
  if (window.top !== window) return;
  let done = false, timer = null;

  const obs = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(run, 400); });

  function run() {
    if (done || !document.querySelector('input[type="password"]')) return;
    done = true;
    obs.disconnect();
    chrome.runtime.sendMessage({ type: "passwordField" }).then((res) => { if (res) banner(res); }).catch(() => {});
  }

  function banner(res) {
    const host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;top:0;left:0;right:0;z-index:2147483647";
    const root = host.attachShadow({ mode: "closed" });
    const colors = { warn: "#b42318", caution: "#b54708", info: "#175cd3" };
    const wrap = document.createElement("div");
    wrap.style.cssText = `font:14px system-ui,sans-serif;color:#fff;background:${colors[res.level] || colors.info};` +
      "padding:10px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;box-shadow:0 2px 8px rgba(0,0,0,.4)";
    const msg = document.createElement("span");
    msg.textContent = "⚠ " + res.text;
    msg.style.flex = "1 1 300px";
    const btn = (label, fn) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText = "font:inherit;padding:4px 10px;border-radius:5px;border:1px solid #fff;background:transparent;color:#fff;cursor:pointer";
      b.onclick = fn;
      return b;
    };
    wrap.append(
      msg,
      btn("Důvěřovat této doméně", () => { chrome.runtime.sendMessage({ type: "trust" }); host.remove(); }),
      btn("Zavřít", () => host.remove())
    );
    root.append(wrap);
    document.documentElement.append(host);
  }

  obs.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => obs.disconnect(), 60000);
  run();
})();
