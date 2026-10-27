/*
  services.js
  قائمة الخدمات وطلب خدمة من الصفحة الرئيسية.

  - يقرأ الخدمات المفعّلة من جدول services ويعرضها.
  - يحسب التكلفة = سعر الوحدة × الكمية.
  - يعرض رصيد المحفظة للمستخدم المسجّل.
  - يرسل الطلب عبر الدالة create_order (تخصم من المحفظة على الخادم).
*/

(function () {
  "use strict";

  const H = window.FormHelpers;

  const CATEGORY_ICON = {
    instagram: "instagram",
    tiktok: "tiktok",
    youtube: "youtube",
    facebook: "facebook",
    twitter: "twitter",
    x: "twitter",
    telegram: "telegram",
    whatsapp: "whatsapp",
  };

  const PLATFORM_MAP = {
    instagram: { label: "إنستغرام", icon: "instagram" },
    tiktok: { label: "تيك توك", icon: "tiktok" },
    youtube: { label: "يوتيوب", icon: "youtube" },
    facebook: { label: "فيسبوك", icon: "facebook" },
    twitter: { label: "تويتر / X", icon: "twitter" },
    x: { label: "تويتر / X", icon: "twitter" },
    telegram: { label: "تيليجرام", icon: "telegram" },
    whatsapp: { label: "واتساب", icon: "whatsapp" },
  };

  const ERROR_TEXT = {
    not_authenticated: "انتهت الجلسة، يرجى تسجيل الدخول من جديد.",
    invalid_quantity: "الكمية غير صحيحة.",
    empty_target: "أدخل رابط الحساب أو المنشور.",
    service_not_found: "الخدمة غير متاحة حاليًا.",
    quantity_out_of_range: "الكمية خارج النطاق المسموح لهذه الخدمة.",
    insufficient_funds: "رصيدك غير كافٍ. اشحن محفظتك ثم أعد المحاولة.",
  };

  let services = [];
  let byId = {};
  let formWired = false;
  let dataLoaded = false;

  function client() {
    return window.SupabaseClient;
  }
  function uid() {
    return window.AppSession && window.AppSession.user
      ? window.AppSession.user.id
      : null;
  }
  function fmt(v) {
    return Number(v || 0)
      .toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderPlatforms() {
    const grid = document.getElementById("platforms-grid");
    const byPlatform = document.getElementById("services-by-platform");
    const list = document.getElementById("services-list");
    const status = document.getElementById("services-status");
    const empty = document.getElementById("services-empty");
    const orderCard = document.getElementById("order-card");
    if (!grid) return;

    if (status) status.hidden = true;
    if (byPlatform) byPlatform.hidden = true;
    grid.innerHTML = "";
    if (list) list.innerHTML = "";

    if (!services.length) {
      if (empty) empty.hidden = false;
      if (orderCard) orderCard.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    if (orderCard) orderCard.hidden = false;

    const groups = {};
    services.forEach(function (s) {
      const key = window.Platforms
        ? window.Platforms.classify(s)
        : String(s.platform || s.category || "other").toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });

    // ترتيب ثابت للمنصات المعروفة، ثم غير المصنف في الآخر
    const ORDER = [
      "instagram", "tiktok", "youtube", "facebook", "twitter",
      "telegram", "whatsapp", "snapchat", "spotify", "discord",
      "linkedin", "pinterest", "other",
    ];
    const keys = Object.keys(groups).sort(function (a, b) {
      const ia = ORDER.indexOf(a);
      const ib = ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    keys.forEach(function (key) {
      const meta = window.Platforms
        ? { label: window.Platforms.label(key), icon: window.Platforms.icon(key) }
        : PLATFORM_MAP[key] || { label: key, icon: CATEGORY_ICON[key] || "sparkles" };
      const card = document.createElement("button");
      card.type = "button";
      card.className = "service-card";
      card.innerHTML =
        '<span class="service-logo"><span data-icon="' + meta.icon + '" data-icon-size="20"></span></span>' +
        '<div class="service-info"><div class="service-name">' +
        escapeHtml(meta.label) +
        "</div><div style=\"color:var(--color-text-muted);font-size:12px\">" +
        groups[key].length +
        " خدمة</div></div>";
      card.addEventListener("click", function () {
        renderServicesForPlatform(key, groups[key], meta.label);
      });
      grid.appendChild(card);
    });

    if (window.Icons && window.Icons.hydrateIcons) window.Icons.hydrateIcons(grid);
  }

  function renderServicesForPlatform(key, items, label) {
    const grid = document.getElementById("platforms-grid");
    const byPlatform = document.getElementById("services-by-platform");
    const title = document.getElementById("platform-title");
    const list = document.getElementById("services-list");
    const back = document.getElementById("back-to-platforms");
    if (!byPlatform || !list) return;

    if (grid) grid.hidden = true;
    byPlatform.hidden = false;
    if (title) title.textContent = label || key;
    list.innerHTML = "";

    items.forEach(function (s) {
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML =
        "<h3 style=\"margin:0 0 6px\">" +
        escapeHtml(s.name) +
        "</h3>" +
        '<p style="margin:0;color:var(--color-text-muted);font-size:0.9rem">' +
        (s.description ? escapeHtml(s.description) : "") +
        "</p>" +
        '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;color:var(--color-text-muted);font-size:0.88rem"><span>السعر: <strong style="color:var(--color-text)">' +
        fmt(s.rate) +
        "</strong> د.ل</span><span>الحد الأدنى: " +
        s.min_qty +
        (s.max_qty ? " - الأقصى: " + s.max_qty : "") +
        "</span></div>" +
        '<button class="btn btn--primary btn--sm" style="margin-top:12px" type="button" data-pick="' +
        s.id +
        '">اختيار الخدمة</button>';
      list.appendChild(card);
    });

    if (window.Icons && window.Icons.hydrateIcons) window.Icons.hydrateIcons(list);

    list.querySelectorAll("[data-pick]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const select = document.getElementById("order-service");
        if (!select) return;
        select.value = btn.getAttribute("data-pick");
        select.dispatchEvent(new Event("change", { bubbles: true }));
        const qty = document.getElementById("order-quantity");
        if (qty) {
          qty.focus();
          qty.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        const orderCard = document.getElementById("order-card");
        if (orderCard) {
          orderCard.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });

    if (back) {
      back.onclick = function () {
        byPlatform.hidden = true;
        if (grid) grid.hidden = false;
      };
    }
  }

  /* ——— العرض ——— */
  function renderServices() {
    renderPlatforms();
  }

  function fillSelect() {
    const select = document.getElementById("order-service");
    if (!select) return;
    select.innerHTML = "";
    services.forEach(function (s) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name + " — " + fmt(s.rate) + " د.ل/وحدة";
      select.appendChild(opt);
    });
    if (services.length) select.value = services[0].id;
    updateForService();
  }

  function currentService() {
    const select = document.getElementById("order-service");
    return select ? byId[select.value] : null;
  }

  function updateForService() {
    const s = currentService();
    const hint = document.getElementById("order-quantity-hint");
    const qty = document.getElementById("order-quantity");
    if (!s) return;

    if (hint) {
      hint.textContent =
        "الحد الأدنى " +
        s.min_qty +
        (s.max_qty ? " والحد الأقصى " + s.max_qty : "") +
        " لهذه الخدمة.";
    }
    if (qty) {
      qty.min = String(s.min_qty);
      if (s.max_qty) qty.max = String(s.max_qty);
      else qty.removeAttribute("max");
      if (!qty.value) qty.value = String(s.min_qty);
    }
    updateCharge();
  }

  function updateCharge() {
    const s = currentService();
    const out = document.getElementById("order-charge");
    const qtyEl = document.getElementById("order-quantity");
    if (!out) return;
    if (!s || !qtyEl || !qtyEl.value) {
      out.textContent = "—";
      return;
    }
    const q = Number(qtyEl.value);
    if (isNaN(q) || q <= 0) {
      out.textContent = "—";
      return;
    }
    out.textContent = fmt(s.rate * q) + " د.ل";
  }

  /* ——— تحميل البيانات ——— */
  async function loadServices() {
    const c = client();
    if (!c) return;

    const baseFields = "id, name, category, description, rate, min_qty, max_qty, sort_order";
    let { data, error } = await c
      .from("services")
      .select(baseFields + ", platform, platform_source")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    // توافق مع قاعدة بيانات لم يُطبَّق عليها الـ migration بعد:
    // نقرأ الأعمدة الأساسية فقط ونصنّف محليًا.
    if (error) {
      const retry = await c
        .from("services")
        .select(baseFields)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      const status = document.getElementById("services-status");
      if (status) {
        status.className = "alert alert--danger";
        status.innerHTML =
          '<span data-icon="alert" data-icon-size="20"></span><div><p>تعذّر تحميل الخدمات الآن.</p></div>';
        if (window.Icons) window.Icons.hydrateIcons(status);
      }
      return;
    }

    services = (data || []).map(function (s) {
      if (!s.platform && window.Platforms) {
        s.platform = window.Platforms.classify(s);
        s.platform_source = "auto";
      }
      return s;
    });
    byId = {};
    services.forEach(function (s) {
      byId[String(s.id)] = s;
    });

    renderServices();
    fillSelect();
  }

  async function loadBalance() {
    const c = client();
    const id = uid();
    const out = document.getElementById("order-balance");
    if (!out) return;
    if (!c || !id) {
      out.textContent = "—";
      return;
    }
    const { data, error } = await c
      .from("wallets")
      .select("balance")
      .eq("user_id", id)
      .maybeSingle();
    if (error) return;
    out.textContent = fmt(data ? data.balance : 0) + " د.ل";
  }

  /* ——— الجلسة ——— */
  function applyAuthState() {
    const authed = Boolean(uid());
    const note = document.getElementById("order-auth-note");
    const form = document.getElementById("order-form");
    if (note) note.hidden = authed;
    if (form) {
      form.querySelectorAll("input, select, button").forEach(function (el) {
        if (el.closest("#order-auth-note")) return;
        el.disabled = !authed;
      });
    }
    if (authed) {
      loadBalance();
      loadHomeBalance();
    } else {
      const out = document.getElementById("order-balance");
      if (out) out.textContent = "—";
      const home = document.getElementById("home-balance");
      if (home) home.textContent = "—";
    }
  }

  async function loadHomeBalance() {
    const c = client();
    const id = uid();
    const out = document.getElementById("home-balance");
    if (!out) return;
    if (!c || !id) {
      out.textContent = "—";
      return;
    }
    const { data, error } = await c
      .from("wallets")
      .select("balance")
      .eq("user_id", id)
      .maybeSingle();
    if (error) return;
    out.textContent = fmt(data ? data.balance : 0) + " د.ل";
  }

  /* ——— النموذج ——— */
  function wireForm() {
    if (formWired) return;
    const form = document.getElementById("order-form");
    if (!form) return;
    formWired = true;

    const select = document.getElementById("order-service");
    const qty = document.getElementById("order-quantity");
    const target = document.getElementById("order-target");

    if (select) {
      select.addEventListener("change", function () {
        const qv = document.getElementById("order-quantity");
        if (qv) qv.value = "";
        updateForService();
      });
    }
    if (qty) qty.addEventListener("input", updateCharge);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submitOrder();
    });
  }

  function clearErrors() {
    ["order-service", "order-target", "order-quantity"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el && H) H.clearFieldError(el);
    });
  }

  async function submitOrder() {
    const c = client();
    const s = currentService();
    const targetEl = document.getElementById("order-target");
    const qtyEl = document.getElementById("order-quantity");

    clearErrors();

    if (!uid()) {
      window.UI.toast(ERROR_TEXT.not_authenticated, { type: "danger" });
      return;
    }
    if (!s) {
      window.UI.toast("اختر خدمة أولًا.", { type: "warning" });
      return;
    }

    let valid = true;
    const target = (targetEl.value || "").trim();
    if (!target) {
      H.setFieldError(targetEl, "أدخل رابط الحساب أو المنشور.");
      valid = false;
    }
    const q = Number(qtyEl.value);
    if (!qtyEl.value || !Number.isInteger(q) || q <= 0) {
      H.setFieldError(qtyEl, "أدخل كمية صحيحة.");
      valid = false;
    } else if (q < s.min_qty || (s.max_qty && q > s.max_qty)) {
      H.setFieldError(qtyEl, ERROR_TEXT.quantity_out_of_range);
      valid = false;
    }
    if (!valid) {
      window.UI.toast("يرجى تصحيح بيانات الطلب.", { type: "danger" });
      return;
    }

    const btn = document.querySelector('#order-form button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.classList.add("is-loading");
    }

    const { data, error } = await c.rpc("create_order", {
      p_service: Number(s.id),
      p_quantity: q,
      p_target: target,
    });

    if (btn) {
      btn.disabled = false;
      btn.classList.remove("is-loading");
    }

    if (error) {
      window.UI.toast("تعذّر إرسال الطلب، حاول مرة أخرى.", { type: "danger" });
      return;
    }
    if (!data || data.ok !== true) {
      const code = data && data.error;
      window.UI.toast(ERROR_TEXT[code] || "تعذّر إنشاء الطلب.", {
        type: "warning",
        title: "لم يتم إنشاء الطلب",
      });
      return;
    }

    window.UI.toast(
      "تم إنشاء الطلب بتكلفة " +
        fmt(data.charge) +
        " د.ل. رصيدك المتبقي: " +
        fmt(data.balance) +
        " د.ل.",
      { type: "success", title: "تم إرسال الطلب", duration: 8000 }
    );

    qtyEl.value = "";
    updateCharge();
    loadBalance();
  }

  /* ——— الإقلاع ——— */
  function wireOnce() {
    wireForm();
    applyAuthState();
  }

  function loadOnce() {
    if (dataLoaded) return;
    dataLoaded = true;
    loadServices();
    applyAuthState();
  }

  function showUnavailable() {
    const status = document.getElementById("services-status");
    if (!status) return;
    status.hidden = false;
    status.className = "alert alert--warning";
    status.innerHTML =
      '<span data-icon="alert" data-icon-size="20"></span><div><p>تعذّر الاتصال بقاعدة البيانات لعرض الخدمات.</p></div>';
    if (window.Icons) window.Icons.hydrateIcons(status);
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireOnce();
    // في حال اكتمل تحميل العميل قبل تسجيل هذا المستمع.
    if (window.SupabaseClientReady) loadOnce();
  });
  document.addEventListener("supabase:ready", function () {
    wireOnce();
    loadOnce();
  });
  document.addEventListener("supabase:unavailable", function () {
    wireOnce();
    showUnavailable();
  });
  document.addEventListener("session:changed", applyAuthState);
})();
