/*
  icons.js
  مكتبة أيقونات SVG مركزيّة. تُستخدم عبر السمة data-icon على أي عنصر،
  فتُحقن الأيقونة تلقائيًا مع الحفاظ على لون النص الحالي (currentColor).

  أمثلة:
    <span data-icon="wallet"></span>
    <span data-icon="instagram" data-icon-size="22"></span>
*/

const ICONS = {
  /* ——— أيقونات خطية (stroke) ——— */
  bolt: '<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z"/>',
  wallet:
    '<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2"/><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2z"/><circle cx="16" cy="12" r="1.3"/>',
  shield:
    '<path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6z"/><path d="M9.5 12l1.8 1.8 3.4-3.6"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-4"/><path d="M12 16V8"/><path d="M16 16v-6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5l3 1.8"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  "eye-off":
    '<path d="M4 4l16 16"/><path d="M9.9 5.9A9.4 9.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15 15 0 0 1-3.4 4.1"/><path d="M6.2 7.8A15 15 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 3.2-.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  arrow: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.5 3 2.5 14 0 17-2.5-3-2.5-14 0-17z"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/>',
  headset:
    '<path d="M4 13v-1a8 8 0 0 1 16 0v1"/><path d="M4 13a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z"/><path d="M20 13a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h3"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 4.5L20 16"/><path d="M20 20v-4h-4"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 12H3"/><path d="M6 8l-4 4 4 4"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
  sparkles: '<path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z"/><path d="M19 4v3M17.5 5.5h3"/>',
  settings:
    '<path d="M4 6h10"/><path d="M18 6h2"/><circle cx="16" cy="6" r="2"/><path d="M4 12h2"/><path d="M10 12h10"/><circle cx="8" cy="12" r="2"/><path d="M4 18h8"/><path d="M16 18h4"/><circle cx="14" cy="18" r="2"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  rocket:
    '<path d="M5 15c-1 1-1.5 4-1.5 4s3-.5 4-1.5"/><path d="M14 5c2.5-2.5 6-2.5 6-2.5s0 3.5-2.5 6l-4 4-3.5-3.5z"/><circle cx="15" cy="9" r="1.3"/><path d="M9 12 6 11l-1 3 4 1"/><path d="M12 15l1 3 3-1 1-4"/>',

  /* ——— أيقونات المنصات (filled) ——— */
  instagram:
    '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="7" r="1.2" fill="currentColor"/>',
  tiktok:
    '<path d="M14 4c.4 2.6 2 4.2 4.5 4.4v3c-1.7 0-3.2-.5-4.5-1.4v5.6a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3.1a2.5 2.5 0 1 0 1.7 2.4V4z" fill="currentColor"/>',
  facebook:
    '<path d="M15.5 8H13.2c-.4 0-.7.4-.7.9V11h3l-.4 3h-2.6v7H9.2v-7H7v-3h2.2V8.6C9.2 6.6 10.6 5 12.7 5c.9 0 1.7.1 2.8.2z" fill="currentColor"/>',
  youtube:
    '<path d="M21.6 8.2s-.2-1.4-.8-2c-.7-.8-1.6-.8-2-.9C16.3 5 12 5 12 5s-4.3 0-6.8.3c-.4 0-1.3 0-2 .9-.6.6-.8 2-.8 2S2.2 9.8 2.2 11.5v1.6c0 1.6.2 3.3.2 3.3s.2 1.4.8 2c.7.8 1.7.8 2.1.9 1.5.1 6.7.2 6.7.2s4.3 0 6.8-.3c.4 0 1.3-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.3v-1.6c0-1.7-.2-3.3-.2-3.3z" fill="currentColor"/><path d="M10 14.6l4.5-2.6L10 9.4z" fill="#fff"/>',
  twitter:
    '<path d="M17.5 3h3l-6.6 7.6L21.8 21h-6l-4.4-5.8L6.4 21H3.3l7-8.1L2.6 3h6.1l4 5.3zm-1 16h1.6L7.5 4.7H5.8z" fill="currentColor"/>',
  telegram:
    '<path d="M21 4.5 2.8 11.4c-1 .4-1 1.1-.2 1.3l4.6 1.4 1.8 5.4c.2.6.4.8 1 .8.5 0 .8-.2 1.1-.5l2.2-2.1 4.6 3.4c.8.5 1.4.2 1.6-.8L21.7 5.4c.3-1.1-.4-1.6-1.2-1.3z" fill="currentColor"/>',
  whatsapp:
    '<path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.6-1.2A9 9 0 1 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 8.5c-.3 0-.8.2-1 .6-.4.6-.4 1.6.6 3s2.4 2 3.4 2.2c.9.1 1.5-.1 1.9-.5.3-.3.5-.8.4-1.1l-1.3-.7c-.2-.1-.4-.1-.5.1l-.4.5c-.1.2-.3.2-.5.1-.6-.3-1.5-1-1.8-1.7-.1-.2 0-.4.1-.5l.4-.4c.1-.1.1-.3.1-.5l-.5-1.2c-.1-.3-.3-.3-.5-.3z" fill="currentColor"/>',
  snapchat:
    '<path d="M12 3c2.8 0 4.5 2 4.3 4.8 0 .6-.1 1.2-.1 1.5.3.1.8-.2 1.3-.2.6 0 1 .4 1 .8 0 .6-.9.8-1.6 1-.4.1-.6.2-.6.5 0 .9 2.1 3.2 4 3.6.3.1.3.4 0 .6-.6.3-1.4.4-1.6.7-.2.3-.1.9-.4 1.1-.4.2-1.2-.2-2.1 0-.7.2-1.4 1.2-3.2 1.2s-2.5-1-3.2-1.2c-.9-.2-1.7.2-2.1 0-.3-.2-.2-.8-.4-1.1-.2-.3-1-.4-1.6-.7-.3-.2-.3-.5 0-.6 1.9-.4 4-2.7 4-3.6 0-.3-.2-.4-.6-.5-.7-.2-1.6-.4-1.6-1 0-.4.4-.8 1-.8.5 0 1 .3 1.3.2 0-.3-.1-.9-.1-1.5C7.5 5 9.2 3 12 3z" fill="currentColor"/>',
};

function createIcon(name, size) {
  const inner = ICONS[name];
  if (!inner) return null;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size || 20);
  svg.setAttribute("height", size || 20);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.innerHTML = inner;
  return svg;
}

function hydrateIcons(root) {
  const scope = root || document;
  scope.querySelectorAll("[data-icon]").forEach(function (el) {
    const name = el.getAttribute("data-icon");
    const size = el.getAttribute("data-icon-size");
    // يمنع تكرار الحقن إذا ما استُدعيت الدالة أكثر من مرة على نفس العنصر.
    if (el.firstElementChild) return;
    const svg = createIcon(name, size);
    if (svg) {
      el.appendChild(svg);
      el.setAttribute("aria-hidden", el.getAttribute("aria-hidden") || "true");
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  hydrateIcons();
});

window.Icons = { createIcon, hydrateIcons, list: ICONS };
