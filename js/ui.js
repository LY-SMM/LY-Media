/*
  ui.js
  أدوات واجهة مشتركة: التنبيهات المنبثقة (Toast) وربط الحقول بتلميحاتها.
*/

(function () {
  "use strict";

  /* ——— التنبيهات المنبثقة ——— */
  const ICON_FOR_TYPE = {
    success: "check",
    danger: "alert",
    warning: "alert",
    info: "info",
  };

  function getRegion() {
    let region = document.querySelector(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    return region;
  }

  function toast(message, options) {
    const opts = Object.assign(
      { type: "info", title: "", duration: 4000 },
      options || {}
    );
    const region = getRegion();

    const el = document.createElement("div");
    el.className = "toast toast--" + opts.type;

    const iconWrap = document.createElement("span");
    iconWrap.className =
      "toast__icon toast__icon--" + opts.type;
    if (window.Icons) {
      const svg = window.Icons.createIcon(ICON_FOR_TYPE[opts.type] || "info");
      if (svg) iconWrap.appendChild(svg);
    }

    const body = document.createElement("div");
    body.className = "toast__body";
    if (opts.title) {
      const t = document.createElement("p");
      t.className = "toast__title";
      t.textContent = opts.title;
      body.appendChild(t);
    }
    const m = document.createElement("p");
    m.className = "toast__msg";
    m.textContent = message;
    body.appendChild(m);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "toast__close";
    close.setAttribute("aria-label", "إغلاق التنبيه");
    close.textContent = "×";

    el.appendChild(iconWrap);
    el.appendChild(body);
    el.appendChild(close);

    function remove() {
      el.classList.add("is-leaving");
      setTimeout(function () {
        el.remove();
      }, 220);
    }

    close.addEventListener("click", remove);
    region.appendChild(el);
    if (opts.duration > 0) setTimeout(remove, opts.duration);
    return el;
  }

  /* ——— ربط الحقول بتلميحاتها ورسائل الخطأ ——— */
  function initFieldA11y() {
    document.querySelectorAll(".field").forEach(function (field) {
      const label = field.querySelector("label[for]");
      if (!label) return;

      const forId = label.getAttribute("for");
      const input = document.getElementById(forId);
      if (!input) return;

      const hint = field.querySelector(".field__hint");
      const error = field.querySelector(".field__error");
      const described = [];

      if (hint && !hint.id) hint.id = forId + "-hint";
      if (error && !error.id) error.id = forId + "-error";
      if (hint) described.push(hint.id);
      if (error) described.push(error.id);

      if (described.length) {
        input.setAttribute("aria-describedby", described.join(" "));
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initFieldA11y();
  });

  window.UI = { toast };
})();
