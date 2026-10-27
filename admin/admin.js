/*
  admin.js
  نواة منطقة الإدارة:
  - بناء الشريط الجانبي والشريط العلوي (لتقليل التكرار بين الصفحات).
  - بوابة صلاحية: تتطلّب جلسة ودور admin، وإلا تعيد التوجيه.
  - وحدات لكل صفحة تُختار عبر data-page على <body>.
*/

(function () {
  "use strict";

  const NAV = [
    { key: "dashboard", label: "نظرة عامة", file: "index.html", icon: "chart" },
    { key: "users", label: "المستخدمون", file: "users.html", icon: "user" },
    { key: "providers", label: "المزوّدون", file: "providers.html", icon: "grid" },
    { key: "services", label: "الخدمات", file: "services.html", icon: "sparkles" },
    { key: "orders", label: "الطلبات", file: "orders.html", icon: "bolt" },
    { key: "recharges", label: "الاستلامات", file: "recharges.html", icon: "wallet" },
    { key: "smsraed", label: "ربط SMS RAEED", file: "smsraed.html", icon: "globe" },
    { key: "settings", label: "الإعدادات", file: "settings.html", icon: "settings" },
  ];

  const COMPANY_LABEL = { libyana: "ليبيانا", almadar: "المدار" };
  const ORDER_STATUS = {
    pending: "قيد الانتظار",
    processing: "قيد التنفيذ",
    completed: "مكتمل",
    canceled: "ملغى",
    refunded: "مُسترجع",
  };
  const RECHARGE_STATUS = {
    pending: { label: "بانتظار التحقق", cls: "badge--pending" },
    success: { label: "ناجح", cls: "badge--success" },
    failed: { label: "فاشل", cls: "badge--failed" },
    cancelled: { label: "ملغى", cls: "badge--muted" },
    needs_review: { label: "يحتاج مراجعة", cls: "badge--review" },
  };

  const profilesMap = {};
  let servicesMap = {};
  let sideBuilt = false;
  let shellWired = false;
  let started = false;

  /* ——— أدوات ——— */
  function client() {
    return window.SupabaseClient;
  }
  function el(id) {
    return document.getElementById(id);
  }
  function uid() {
    return window.AppSession && window.AppSession.user
      ? window.AppSession.user.id
      : null;
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(value) {
    return Number(value || 0)
      .toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const p = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear() + "/" + p(d.getMonth() + 1) + "/" + p(d.getDate()) +
      " " + p(d.getHours()) + ":" + p(d.getMinutes())
    );
  }
  function fail(msg) {
    window.UI.toast(msg, { type: "danger" });
  }
  function ok(msg) {
    window.UI.toast(msg, { type: "success" });
  }
  function soon(msg) {
    window.UI.toast(msg || "هذه الميزة ستُفعّل قريبًا.", {
      type: "info",
      title: "قريبًا",
    });
  }
  function userEmail(id) {
    const p = profilesMap[id];
    return p ? p.email || p.full_name || id : id;
  }
  function pageKey() {
    return document.body.getAttribute("data-page") || "dashboard";
  }

  /* ——— الهيكل ——— */
  function buildShell() {
    const side = el("admin-side");
    if (side && !sideBuilt) {
      sideBuilt = true;
      const brand = document.createElement("a");
      brand.className = "admin__brand";
      brand.href = "../index.html";
      brand.innerHTML =
        '<img src="../assets/logo.svg" alt="" />' +
        '<span class="admin__unit"><strong>ليبيا GO</strong><small>ADMIN</small></span>';
      side.appendChild(brand);

      const close = document.createElement("button");
      close.className = "admin__close";
      close.type = "button";
      close.setAttribute("aria-label", "إغلاق القائمة");
      close.innerHTML = '<span data-icon="x" data-icon-size="18"></span>';
      close.addEventListener("click", function () { closeSide(); });
      side.appendChild(close);

      const nav = document.createElement("nav");
      nav.className = "admin__nav";
      const key = pageKey();
      NAV.forEach(function (item) {
        const a = document.createElement("a");
        a.href = item.file;
        if (item.key === key) a.className = "is-active";
        const icon = document.createElement("span");
        icon.setAttribute("data-icon", item.icon);
        icon.setAttribute("data-icon-size", "18");
        const label = document.createElement("span");
        label.textContent = item.label;
        a.appendChild(icon);
        a.appendChild(label);
        a.addEventListener("click", function () { closeSide(); });
        nav.appendChild(a);
      });
      side.appendChild(nav);
      if (window.Icons && window.Icons.hydrateIcons) window.Icons.hydrateIcons(side);
    }

    let overlay = document.querySelector(".admin__overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "admin__overlay";
      document.body.appendChild(overlay);
    }
    if (side && overlay && !shellWired) {
      shellWired = true;
      overlay.addEventListener("click", closeSide);
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeSide();
      });
    }

    const top = el("admin-top");
    if (top) {
      top.innerHTML = "";
      const current = NAV.filter(function (n) { return n.key === pageKey(); })[0];

      const lead = document.createElement("div");
      lead.className = "admin__top-lead";

      const menu = document.createElement("button");
      menu.className = "admin__menu-btn";
      menu.type = "button";
      menu.setAttribute("aria-label", "فتح القائمة");
      menu.setAttribute("aria-expanded", "false");
      menu.innerHTML = '<span class="admin__menu-bars"></span>';
      menu.addEventListener("click", openSide);
      lead.appendChild(menu);

      const h1 = document.createElement("h1");
      h1.textContent = current ? current.label : "لوحة الإدارة";
      lead.appendChild(h1);
      top.appendChild(lead);

      const box = document.createElement("div");
      box.className = "admin__user";

      const themeBtn = document.createElement("button");
      themeBtn.className = "btn btn--outline btn--sm";
      themeBtn.type = "button";
      themeBtn.setAttribute("aria-label", "تبديل الوضع الداكن");
      function syncThemeIcon() {
        const dark = document.documentElement.getAttribute("data-theme") !== "light";
        themeBtn.innerHTML = "";
        const icon = window.Icons && window.Icons.createIcon(dark ? "sun" : "moon", 16);
        if (icon) themeBtn.appendChild(icon);
        else themeBtn.textContent = dark ? "☀" : "☾";
      }
      themeBtn.addEventListener("click", function () {
        const dark = document.documentElement.getAttribute("data-theme") !== "light";
        const next = dark ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        try { localStorage.setItem("libyago-admin-theme", next); } catch (e) {}
        syncThemeIcon();
      });
      syncThemeIcon();
      box.appendChild(themeBtn);

      const user = window.AppSession && window.AppSession.user;
      const who = document.createElement("span");
      who.className = "admin__who";
      who.textContent =
        window.AppAuth && user ? window.AppAuth.displayName(user) : "—";
      const out = document.createElement("button");
      out.className = "btn btn--outline btn--sm";
      out.type = "button";
      out.textContent = "خروج";
      out.addEventListener("click", function () {
        if (window.AppAuth) window.AppAuth.signOut();
      });
      box.appendChild(who);
      box.appendChild(out);
      top.appendChild(box);
    }
  }

  function openSide() {
    const side = el("admin-side");
    const overlay = document.querySelector(".admin__overlay");
    const menu = document.querySelector(".admin__menu-btn");
    if (!side) return;
    side.classList.add("is-open");
    if (overlay) overlay.classList.add("is-open");
    document.body.classList.add("admin-nav-open");
    if (menu) menu.setAttribute("aria-expanded", "true");
    const close = side.querySelector(".admin__close");
    if (close) close.focus();
  }

  function closeSide() {
    const side = el("admin-side");
    const overlay = document.querySelector(".admin__overlay");
    const menu = document.querySelector(".admin__menu-btn");
    if (!side) return;
    side.classList.remove("is-open");
    if (overlay) overlay.classList.remove("is-open");
    document.body.classList.remove("admin-nav-open");
    if (menu) menu.setAttribute("aria-expanded", "false");
  }

  /* ——— بوابة الصلاحية ——— */
  function guard() {
    return new Promise(function (resolve) {
      const c = client();
      const session = window.AppSession && window.AppSession.session;
      function denyUser() {
        location.replace("../wallet.html");
      }
      if (!session) {
        location.replace("../login.html");
        resolve(false);
        return;
      }
      const role = window.AppSession.role;
      if (role) {
        if (role !== "admin") { denyUser(); resolve(false); return; }
        resolve(true);
        return;
      }
      c.from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle()
        .then(function (res) {
          const r = res && res.data ? res.data.role : null;
          window.AppSession.role = r;
          if (r !== "admin") { denyUser(); resolve(false); return; }
          resolve(true);
        })
        .catch(function () {
          denyUser();
          resolve(false);
        });
    });
  }

  /* ——— نظرة عامة ——— */
  function dashboard() {
    const c = client();
    const set = function (id, value) {
      const node = el(id);
      if (node) node.textContent = value;
    };
    Promise.all([
      c.from("profiles").select("*", { count: "exact", head: true }),
      c.from("providers").select("*", { count: "exact", head: true }),
      c.from("services").select("*", { count: "exact", head: true }),
      c.from("orders").select("*", { count: "exact", head: true }),
      c.from("recharges").select("*", { count: "exact", head: true }).in("status", ["pending", "needs_review"]),
    ]).then(function (r) {
      set("stat-users", r[0].count == null ? "—" : r[0].count);
      set("stat-providers", r[1].count == null ? "—" : r[1].count);
      set("stat-services", r[2].count == null ? "—" : r[2].count);
      set("stat-orders", r[3].count == null ? "—" : r[3].count);
      set("stat-recharges", r[4].count == null ? "—" : r[4].count);
    });

    const body = el("recent-orders-body");
    if (body) {
      c.from("orders")
        .select("id, user_id, service_id, quantity, charge, status, created_at")
        .order("created_at", { ascending: false })
        .limit(8)
        .then(function (res) {
          const rows = (res && res.data) || [];
          if (!rows.length) {
            body.innerHTML = '<tr><td colspan="5">لا توجد طلبات بعد.</td></tr>';
            return;
          }
          body.innerHTML = rows
            .map(function (o) {
              const meta = ORDER_STATUS[o.status] || o.status;
              return (
                "<tr>" +
                "<td>" + o.id + "</td>" +
                "<td>" + escapeHtml(userEmail(o.user_id)) + "</td>" +
                "<td>" + o.quantity + "</td>" +
                "<td>" + fmt(o.charge) + "</td>" +
                "<td>" + escapeHtml(meta) + "</td>" +
                "</tr>"
              );
            })
            .join("");
        });
    }
  }

  /* ——— المستخدمون ——— */
  function users() {
    const c = client();
    const tbody = el("users-body");
    if (!tbody) return;

    c.from("profiles")
      .select("id, email, full_name, role, created_at")
      .order("created_at", { ascending: false })
      .then(function (pRes) {
        const rows = (pRes && pRes.data) || [];
        return c.from("wallets").select("user_id, balance").then(function (wRes) {
          const balances = {};
          ((wRes && wRes.data) || []).forEach(function (w) {
            balances[w.user_id] = w.balance;
          });
          if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="5">لا يوجد مستخدمون بعد.</td></tr>';
            return;
          }
          tbody.innerHTML = rows
            .map(function (p) {
              const roleCls = p.role === "admin" ? "badge--success" : "badge--muted";
              const roleLabel = p.role === "admin" ? "مشرف" : "مستخدم";
              return (
                '<tr data-id="' + p.id + '">' +
                "<td>" + escapeHtml(p.full_name || "—") + "</td>" +
                '<td dir="ltr">' + escapeHtml(p.email || "—") + "</td>" +
                '<td><span class="badge ' + roleCls + '">' + roleLabel + "</span></td>" +
                "<td>" + fmt(balances[p.id]) + " د.ل</td>" +
                "<td>" +
                '<input class="input js-amount" type="number" step="0.01" dir="ltr" style="max-width:110px;display:inline-block" placeholder="0.00" aria-label="المبلغ" /> ' +
                '<button class="btn btn--outline btn--sm" type="button" data-act="adjust">تطبيق</button>' +
                "</td>" +
                "</tr>"
              );
            })
            .join("");
        });
      });
  }

  function adjustBalance(userId, raw) {
    const amount = Number(raw);
    if (!raw || isNaN(amount) || amount === 0) {
      window.UI.toast("أدخل مبلغًا صحيحًا غير صفري.", { type: "warning" });
      return;
    }
    const verb = amount > 0 ? "إضافة" : "خصم";
    if (!window.confirm("تأكيد " + verb + " " + Math.abs(amount).toFixed(2) + " د.ل من رصيد هذا المستخدم؟")) return;
    client()
      .rpc("admin_adjust_balance", { p_user: userId, p_amount: amount })
      .then(function (res) {
        if (res.error || (res.data && res.data.ok === false)) {
          fail("تعذّر تعديل الرصيد.");
          return;
        }
        ok("تم تحديث الرصيد.");
        users();
      });
  }

  /* ——— المزوّدون ——— */
  function providers() {
    const c = client();
    const tbody = el("providers-body");
    if (!tbody) return;
    c.from("providers")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })
      .then(function (res) {
        if (res.error) {
          tbody.innerHTML = '<tr><td colspan="5">تعذّر تحميل المزوّدين.</td></tr>';
          return;
        }
        const rows = res.data || [];
        if (!rows.length) {
          tbody.innerHTML = '<tr><td colspan="5">لا يوجد مزوّدون بعد. أضف أول مزوّد من الأعلى.</td></tr>';
          return;
        }
        tbody.innerHTML = rows
          .map(function (p) {
            return (
              '<tr data-id="' + p.id + '">' +
              '<td><input class="input js-name" type="text" value="' + escapeHtml(p.name) + '" style="max-width:160px" /></td>' +
              '<td><input class="input js-url" type="url" dir="ltr" value="' + escapeHtml(p.api_url || "") + '" style="max-width:220px" placeholder="https://..." /></td>' +
              '<td><input class="input js-key" type="password" dir="ltr" value="' + escapeHtml(p.api_key || "") + '" style="max-width:180px" placeholder="API key" autocomplete="off" /></td>' +
              "<td>" + fmt(p.balance) + "</td>" +
              '<td><input type="checkbox" class="js-active" ' + (p.is_active ? "checked" : "") + " /></td>" +
              "<td>" +
              '<button class="btn btn--outline btn--sm" type="button" data-act="save-provider">حفظ</button> ' +
              '<button class="btn btn--ghost btn--sm" type="button" data-act="del-provider">حذف</button>' +
              "</td>" +
              "</tr>"
            );
          })
          .join("");
      });
  }

  function addProvider(form) {
    const name = el("prov-name").value.trim();
    const url = el("prov-url").value.trim();
    const key = el("prov-key").value.trim();
    if (!name) {
      window.UI.toast("أدخل اسم المزوّد.", { type: "warning" });
      return;
    }
    client()
      .from("providers")
      .insert({ name: name, api_url: url || null, api_key: key || null, is_active: true })
      .then(function (res) {
        if (res.error) { fail("تعذّر إضافة المزوّد."); return; }
        form.reset();
        ok("تمت إضافة المزوّد.");
        providers();
      });
  }

  function saveProvider(id, row) {
    const patch = {
      name: row.querySelector(".js-name").value.trim(),
      api_url: row.querySelector(".js-url").value.trim() || null,
      api_key: row.querySelector(".js-key").value.trim() || null,
      is_active: row.querySelector(".js-active").checked,
    };
    if (!patch.name) { window.UI.toast("اسم المزوّد مطلوب.", { type: "warning" }); return; }
    client()
      .from("providers")
      .update(patch)
      .eq("id", id)
      .then(function (res) {
        if (res.error) { fail("تعذّر حفظ المزوّد."); return; }
        ok("تم حفظ المزوّد.");
      });
  }

  function deleteProvider(id) {
    const c = client();
    if (!c) { fail("الاتصال غير جاهز."); return; }
    const pid = Number(id);
    if (!Number.isFinite(pid)) { fail("معرّف المزوّد غير صالح."); return; }

    // نعرض أرقامًا حقيقية قبل التأكيد: عدد الخدمات والطلبات المتأثرة.
    Promise.all([
      c.from("providers").select("name").eq("id", pid).maybeSingle(),
      c.from("services").select("id").eq("provider_id", pid),
    ])
      .then(function (r) {
        const providerName =
          (r[0] && r[0].data && r[0].data.name) || "هذا المزوّد";
        const ids = ((r[1] && r[1].data) || []).map(function (s) { return s.id; });

        const ordersTask = ids.length
          ? c.from("orders").select("id", { count: "exact", head: true }).in("service_id", ids)
          : Promise.resolve({ count: 0 });

        return ordersTask.then(function (oRes) {
          const nOrders = (oRes && oRes.count) || 0;
          const lines = [
            "حذف المزوّد «" + providerName + "» نهائيًا؟",
            "",
            ids.length
              ? "• ستُحذف " + ids.length + " خدمة مرتبطة به نهائيًا."
              : "• لا توجد خدمات مرتبطة به.",
          ];
          if (nOrders) {
            lines.push("• ستبقى " + nOrders + " طلبًا محفوظًا في السجل مع اسم الخدمة.");
          }
          lines.push("", "لا يمكن التراجع عن هذه العملية.");
          if (!window.confirm(lines.join("\n"))) return null;
          return c.rpc("delete_provider_cascade", { p_provider_id: pid });
        });
      })
      .then(function (res) {
        if (!res) return;
        if (res.error) {
          const msg = String(res.error.message || "");
          fail(
            /function|schema|does not exist/i.test(msg)
              ? "دالة الحذف غير مثبّتة. طبّق ملف الهجرة (migration) أولًا."
              : "تعذّر حذف المزوّد: " + msg
          );
          return;
        }
        const data = res.data || {};
        if (data.ok === false) {
          fail(
            data.error === "provider_not_found"
              ? "المزوّد غير موجود مسبقًا."
              : (data.error || "تعذّر حذف المزوّد.")
          );
          return;
        }

        let msg = "تم حذف المزوّد";
        if (data.provider_name) msg += " «" + data.provider_name + "»";
        if (data.services_deleted) {
          msg += " و" + data.services_deleted + " خدمة مرتبطة به";
        }
        msg += ".";
        if (data.orders_detached) {
          msg += " بقيت " + data.orders_detached + " طلبًا محفوظًا في السجل.";
        }
        ok(msg);
        providers();
        if (pageKey() === "services") services();
      })
      .catch(function () {
        fail("تعذّر حذف المزوّد.");
      });
  }

  /* ——— الخدمات ——— */
  const SERVICES_PAGE_SIZE = 50;
  let servicesPage = 1;
  let servicesTotal = 0;
  let servicesCategoriesLoaded = false;

  function servicesState() {
    return {
      search: (el("services-search") && el("services-search").value.trim()) || "",
      platform: (el("services-platform") && el("services-platform").value) || "",
      category: (el("services-category") && el("services-category").value) || "",
      provider: (el("services-provider") && el("services-provider").value) || "",
      status: (el("services-status") && el("services-status").value) || "",
    };
  }

  function escapeLike(value) {
    return value.replace(/[%_,]/g, function (c) { return "\\" + c; });
  }

  function buildServicesQuery(c, state) {
    let q = c.from("services").select("*", { count: "exact" });
    if (state.search) q = q.ilike("name", "%" + escapeLike(state.search) + "%");
    if (state.platform === "other") {
      q = q.or("platform.eq.other,platform.is.null");
    } else if (state.platform) {
      q = q.eq("platform", state.platform);
    }
    if (state.category) q = q.eq("category", state.category);
    if (state.provider) q = q.eq("provider_id", Number(state.provider));
    if (state.status === "active") q = q.eq("is_active", true);
    else if (state.status === "inactive") q = q.eq("is_active", false);
    return q;
  }

  /* ——— قائمة المنصات الموحّدة ——— */
  const PLATFORM_ORDER = [
    "instagram", "tiktok", "youtube", "facebook", "twitter",
    "telegram", "whatsapp", "snapchat", "spotify", "discord",
    "linkedin", "pinterest",
  ];

  function platformLabel(key) {
    if (window.Platforms) return window.Platforms.label(key);
    return key;
  }

  function platformOptionsHtml(current, includeEmpty) {
    let html = includeEmpty ? '<option value="">كل المنصات</option>' : "";
    const seen = {};
    PLATFORM_ORDER.forEach(function (key) {
      seen[key] = true;
      html +=
        '<option value="' + key + '"' +
        (String(current || "") === key ? " selected" : "") +
        ">" + escapeHtml(platformLabel(key)) + "</option>";
    });
    html +=
      '<option value="other"' +
      (String(current || "") === "other" || !current ? " selected" : "") +
      ">" + escapeHtml(platformLabel("other")) + "</option>";
    if (current && !seen[String(current)] && String(current) !== "other") {
      html +=
        '<option value="' + escapeHtml(current) + '" selected>' +
        escapeHtml(String(current)) + "</option>";
    }
    return html;
  }

  function initPlatformSelects() {
    const filter = el("services-platform");
    if (filter && filter.options.length <= 1) {
      filter.innerHTML = platformOptionsHtml("", true);
    }
    const bulk = el("bulk-platform");
    if (bulk && bulk.options.length <= 1) {
      bulk.innerHTML =
        '<option value="">اختر منصة…</option>' +
        platformOptionsHtml("", false).replace(/ selected/g, "");
    }
    const rule = el("rule-platform");
    if (rule && rule.options.length === 0) {
      rule.innerHTML = platformOptionsHtml("", false).replace(/ selected/g, "");
    }
  }

  /* ——— تحديد متعدد ——— */
  let selectedServices = new Set();

  function updateSelectionUi() {
    const count = el("services-selected-count");
    const apply = el("bulk-apply");
    const all = el("services-select-all");
    if (count) {
      count.textContent = selectedServices.size
        ? "تم تحديد " + selectedServices.size + " خدمة"
        : "لم يتم تحديد أي خدمة";
    }
    if (apply) apply.disabled = selectedServices.size === 0;
    if (all) {
      const boxes = Array.prototype.slice.call(
        document.querySelectorAll("#services-body .js-pick")
      );
      all.checked = boxes.length > 0 && boxes.every(function (b) { return b.checked; });
      all.indeterminate = boxes.some(function (b) { return b.checked; }) && !all.checked;
    }
  }

  function services() {
    const c = client();
    const tbody = el("services-body");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9">جارٍ التحميل…</td></tr>';
    selectedServices = new Set();
    updateSelectionUi();

    const state = servicesState();
    const from = (servicesPage - 1) * SERVICES_PAGE_SIZE;
    const to = from + SERVICES_PAGE_SIZE - 1;

    function fetchPage(ignorePlatform) {
      const s = Object.assign({}, state);
      if (ignorePlatform) s.platform = "";
      let q = buildServicesQuery(c, s);
      if (!ignorePlatform) q = q.order("platform", { ascending: true });
      return q
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
    }

    fetchPage(false)
      .then(function (res) {
        // قاعدة البيانات بلا عمود platform بعد ⇒ أعد المحاولة بدون الاعتماد عليه.
        if (res.error && /platform/i.test(String(res.error.message || ""))) {
          return fetchPage(true).then(function (retry) {
            fail("تصنيف المنصة غير متاح بعد. طبّق ملف الهجرة (migration) لتفعيله.");
            return retry;
          });
        }
        return res;
      })
      .then(function (pageRes) {
        return Promise.all([
          pageRes,
          c.from("providers").select("id, name"),
        ]);
      })
      .then(function (r) {
        const provName = {};
        ((r[1] && r[1].data) || []).forEach(function (p) { provName[p.id] = p.name; });

        if (r[0] && r[0].error) {
          tbody.innerHTML = '<tr><td colspan="9">تعذّر تحميل الخدمات.</td></tr>';
          return;
        }
        const rows = (r[0] && r[0].data) || [];
        servicesTotal = (r[0] && typeof r[0].count === "number") ? r[0].count : rows.length;
        servicesMap = {};
        rows.forEach(function (s) { servicesMap[s.id] = s; });

        if (!rows.length) {
          tbody.innerHTML = '<tr><td colspan="9">لا توجد خدمات مطابقة. جرّب تعديل الفلاتر أو ابدأ المزامنة.</td></tr>';
        } else {
          tbody.innerHTML = rows
            .map(function (s) {
              const provider = s.provider_id ? (provName[s.provider_id] || "—") : "—";
              const platform = s.platform || "other";
              const manual = String(s.platform_source || "auto") === "manual";
              return (
                '<tr data-id="' + s.id + '">' +
                '<td class="table__pick"><input type="checkbox" class="js-pick" value="' + s.id + '" aria-label="تحديد الخدمة" /></td>' +
                "<td>" + escapeHtml(s.name) +
                  (manual ? ' <span class="badge badge--muted" title="تصنيف يدوي">يدوي</span>' : "") +
                "</td>" +
                '<td><select class="input js-platform" style="min-width:150px">' + platformOptionsHtml(platform, false) + "</select></td>" +
                '<td dir="ltr">' + escapeHtml(s.category || "—") + "</td>" +
                "<td>" + escapeHtml(provider) + "</td>" +
                '<td><input class="input js-rate" type="number" step="0.0001" min="0" dir="ltr" style="max-width:110px" value="' + s.rate + '" /></td>' +
                '<td><input class="input js-markup" type="number" step="0.01" dir="ltr" style="max-width:90px" value="' + (s.markup == null ? 0 : s.markup) + '" /></td>' +
                '<td><input type="checkbox" class="js-active" ' + (s.is_active ? "checked" : "") + " /></td>" +
                "<td>" +
                '<button class="btn btn--outline btn--sm" type="button" data-act="save-service">حفظ</button> ' +
                '<button class="btn btn--ghost btn--sm" type="button" data-act="del-service">حذف</button>' +
                "</td>" +
                "</tr>"
              );
            })
            .join("");
        }
        renderServicesPager();
        updateSelectionUi();
      })
      .catch(function () {
        tbody.innerHTML = '<tr><td colspan="9">تعذّر تحميل الخدمات.</td></tr>';
      });
  }

  function renderServicesPager() {
    const pager = el("services-pager");
    const countLabel = el("services-count");
    const pages = Math.max(1, Math.ceil(servicesTotal / SERVICES_PAGE_SIZE));
    if (servicesPage > pages) servicesPage = pages;
    if (countLabel) {
      countLabel.textContent = "إجمالي النتائج: " + servicesTotal.toLocaleString("en-US") +
        " — صفحة " + servicesPage + " من " + pages;
    }
    if (!pager) return;
    const prev = servicesPage > 1;
    const next = servicesPage < pages;
    pager.innerHTML =
      '<button class="btn btn--outline btn--sm" type="button" data-page="prev"' + (prev ? "" : " disabled") + ">السابق</button>" +
      '<span class="pager__label">صفحة ' + servicesPage + " / " + pages + "</span>" +
      '<button class="btn btn--outline btn--sm" type="button" data-page="next"' + (next ? "" : " disabled") + ">التالي</button>";
  }

  function loadServiceCategoryOptions() {
    if (servicesCategoriesLoaded) return;
    const sel = el("services-category");
    if (!sel) return;
    servicesCategoriesLoaded = true;
    client()
      .rpc("service_categories")
      .then(function (res) {
        const rows = (res && res.data) || [];
        if (!rows.length) { servicesCategoriesLoaded = false; return; }
        const frag = document.createDocumentFragment();
        rows.forEach(function (r) {
          const name = typeof r === "string" ? r : (r.category || r.name);
          if (!name) return;
          const opt = document.createElement("option");
          opt.value = name;
          opt.textContent = name;
          frag.appendChild(opt);
        });
        sel.appendChild(frag);
      })
      .catch(function () { servicesCategoriesLoaded = false; });
  }

  function loadServiceProviderOptions() {
    const sel = el("services-provider");
    if (!sel) return;
    client()
      .from("providers")
      .select("id, name")
      .order("name", { ascending: true })
      .then(function (res) {
        const rows = (res && res.data) || [];
        const frag = document.createDocumentFragment();
        rows.forEach(function (p) {
          const opt = document.createElement("option");
          opt.value = String(p.id);
          opt.textContent = p.name;
          frag.appendChild(opt);
        });
        sel.appendChild(frag);
      });
  }

  function wireServicesFilters() {
    const search = el("services-search");
    const platform = el("services-platform");
    const category = el("services-category");
    const provider = el("services-provider");
    const status = el("services-status");
    const reset = el("services-reset");
    const pager = el("services-pager");
    let debounce = null;
    if (search) {
      search.addEventListener("input", function () {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(function () { servicesPage = 1; services(); }, 350);
      });
    }
    [platform, category, provider, status].forEach(function (sel) {
      if (sel) sel.addEventListener("change", function () { servicesPage = 1; services(); });
    });
    if (reset) {
      reset.addEventListener("click", function () {
        if (search) search.value = "";
        if (platform) platform.value = "";
        if (category) category.value = "";
        if (provider) provider.value = "";
        if (status) status.value = "";
        servicesPage = 1;
        services();
      });
    }
    if (pager) {
      pager.addEventListener("click", function (e) {
        const btn = e.target.closest("[data-page]");
        if (!btn || btn.disabled) return;
        if (btn.getAttribute("data-page") === "prev" && servicesPage > 1) servicesPage--;
        else if (btn.getAttribute("data-page") === "next") servicesPage++;
        services();
      });
    }
  }

  /* ——— تحديد متعدد وإجراءات جماعية ——— */
  function wireBulkActions() {
    const tbody = el("services-body");
    if (tbody) {
      tbody.addEventListener("change", function (e) {
        const pick = e.target.closest(".js-pick");
        if (!pick) return;
        const id = pick.value;
        if (pick.checked) selectedServices.add(id);
        else selectedServices.delete(id);
        updateSelectionUi();
      });
    }
    const all = el("services-select-all");
    if (all) {
      all.addEventListener("change", function () {
        document.querySelectorAll("#services-body .js-pick").forEach(function (box) {
          box.checked = all.checked;
          if (all.checked) selectedServices.add(box.value);
          else selectedServices.delete(box.value);
        });
        updateSelectionUi();
      });
    }
    const apply = el("bulk-apply");
    if (apply) {
      apply.addEventListener("click", function () {
        const platform = el("bulk-platform") && el("bulk-platform").value;
        const ids = Array.from(selectedServices).map(Number).filter(function (n) {
          return Number.isFinite(n);
        });
        if (!ids.length) { fail("حدّد خدمة واحدة على الأقل."); return; }
        if (!platform) { fail("اختر المنصة التي تريد تطبيقها."); return; }
        if (!window.confirm("تطبيق التصنيف اليدوي على " + ids.length + " خدمة؟")) return;
        apply.disabled = true;
        const original = apply.textContent;
        apply.textContent = "جارٍ التطبيق…";
        client()
          .rpc("bulk_set_service_platform", { p_service_ids: ids, p_platform: platform })
          .then(function (res) {
            if (res.error) { fail("تعذّر تطبيق التصنيف: " + (res.error.message || "")); return; }
            const data = res.data || {};
            if (data.ok === false) { fail(data.error || "تعذّر تطبيق التصنيف."); return; }
            ok("تم تصنيف " + (data.updated || ids.length) + " خدمة يدويًا.");
            services();
          })
          .catch(function () { fail("تعذّر تطبيق التصنيف."); })
          .then(function () {
            apply.disabled = false;
            apply.textContent = original;
          });
      });
    }
    const reclassify = el("services-reclassify");
    if (reclassify) {
      reclassify.addEventListener("click", function () {
        if (!window.confirm("إعادة التصنيف التلقائي لكل الخدمات غير المصنفة يدويًا؟")) return;
        const state = servicesState();
        reclassify.disabled = true;
        const original = reclassify.innerHTML;
        reclassify.textContent = "جارٍ التصنيف…";
        client()
          .rpc("reclassify_services", {
            p_provider_id: state.provider ? Number(state.provider) : null,
            p_only_unclassified: false,
          })
          .then(function (res) {
            if (res.error) { fail("تعذّرت إعادة التصنيف: " + (res.error.message || "")); return; }
            ok("تمت إعادة تصنيف " + (res.data || 0) + " خدمة.");
            services();
          })
          .catch(function () { fail("تعذّرت إعادة التصنيف."); })
          .then(function () {
            reclassify.disabled = false;
            reclassify.innerHTML = original;
            if (window.Icons && window.Icons.hydrateIcons) window.Icons.hydrateIcons(reclassify);
          });
      });
    }

    // تنظيف الخدمات اليتيمة غير المفعّلة (بلا مزوّد).
    const cleanup = el("services-cleanup");
    if (cleanup) {
      cleanup.addEventListener("click", function () {
        cleanup.disabled = true;
        const original = cleanup.innerHTML;
        client()
          .from("services")
          .select("id", { count: "exact", head: true })
          .is("provider_id", null)
          .eq("is_active", false)
          .then(function (res) {
            if (res && res.error) {
              fail("تعذّر حساب الخدمات غير المرتبطة.");
              return null;
            }
            const n = (res && res.count) || 0;
            if (!n) {
              ok("لا توجد خدمات يتيمة غير مفعّلة.");
              return null;
            }
            if (
              !window.confirm(
                "حذف " + n + " خدمة غير مرتبطة بأي مزوّد نهائيًا؟\n\n" +
                  "هذه الخدمات غير مفعّلة ولا تظهر في الموقع."
              )
            ) {
              return null;
            }
            cleanup.textContent = "جارٍ التنظيف…";
            return client().rpc("cleanup_orphan_services");
          })
          .then(function (res) {
            if (!res) return;
            if (res.error) {
              const msg = String(res.error.message || "");
              fail(
                /function|schema|does not exist/i.test(msg)
                  ? "دالة التنظيف غير مثبّتة. طبّق ملف الهجرة (migration) أولًا."
                  : "تعذّر تنظيف الخدمات: " + msg
              );
              return;
            }
            const data = res.data || {};
            if (data.ok === false) {
              fail(data.error || "تعذّر تنظيف الخدمات.");
              return;
            }
            ok("تم حذف " + (data.services_deleted || 0) + " خدمة يتيمة.");
            services();
          })
          .catch(function () { fail("تعذّر تنظيف الخدمات."); })
          .then(function () {
            cleanup.disabled = false;
            cleanup.innerHTML = original;
            if (window.Icons && window.Icons.hydrateIcons) window.Icons.hydrateIcons(cleanup);
          });
      });
    }
  }

  /* ——— قواعد التصنيف ——— */
  function loadRules() {
    const tbody = el("rules-body");
    const count = el("rules-count");
    if (!tbody) return;
    client()
      .from("service_classification_rules")
      .select("id, platform, keyword, priority, is_active")
      .order("platform", { ascending: true })
      .order("priority", { ascending: true })
      .then(function (res) {
        if (res.error) {
          tbody.innerHTML =
            '<tr><td colspan="5">جدول القواعد غير موجود. نفّذ ملف الهجرة 20261027000000_service_platform.sql من Supabase.</td></tr>';
          if (count) count.textContent = "—";
          return;
        }
        const rows = res.data || [];
        if (count) count.textContent = rows.length + " قاعدة";
        if (!rows.length) {
          tbody.innerHTML = '<tr><td colspan="5">لا توجد قواعد. أضف قاعدة من الأعلى.</td></tr>';
          return;
        }
        tbody.innerHTML = rows
          .map(function (r) {
            return (
              '<tr data-id="' + r.id + '">' +
              "<td>" + escapeHtml(platformLabel(r.platform)) + "</td>" +
              '<td dir="auto">' + escapeHtml(r.keyword) + "</td>" +
              '<td dir="ltr">' + Number(r.priority || 0) + "</td>" +
              "<td>" +
              (r.is_active
                ? '<span class="badge badge--success">مفعّلة</span>'
                : '<span class="badge badge--muted">معطّلة</span>') +
              "</td>" +
              "<td>" +
              '<button class="btn btn--ghost btn--sm" type="button" data-act="toggle-rule" data-active="' + (r.is_active ? "1" : "0") + '">' +
              (r.is_active ? "تعطيل" : "تفعيل") + "</button> " +
              '<button class="btn btn--ghost btn--sm" type="button" data-act="del-rule">حذف</button>' +
              "</td>" +
              "</tr>"
            );
          })
          .join("");
      })
      .catch(function () {
        tbody.innerHTML = '<tr><td colspan="5">تعذّر تحميل القواعد.</td></tr>';
      });
  }

  function wireRules() {
    const form = el("rule-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        const platform = el("rule-platform").value;
        const keyword = (el("rule-keyword").value || "").trim();
        const priority = Number(el("rule-priority").value) || 100;
        if (!platform || !keyword) { fail("اختر المنصة واكتب الكلمة المفتاحية."); return; }
        const btn = form.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
        client()
          .from("service_classification_rules")
          .insert({ platform: platform, keyword: keyword, priority: priority })
          .then(function (res) {
            if (res.error) {
              fail(
                /duplicate|unique/i.test(String(res.error.message || ""))
                  ? "هذه القاعدة موجودة مسبقًا."
                  : "تعذّرت إضافة القاعدة: " + (res.error.message || "")
              );
              return;
            }
            ok("تمت إضافة القاعدة.");
            form.reset();
            if (el("rule-priority")) el("rule-priority").value = "100";
            loadRules();
          })
          .catch(function () { fail("تعذّرت إضافة القاعدة."); })
          .then(function () { if (btn) btn.disabled = false; });
      });
    }
    const tbody = el("rules-body");
    if (tbody) {
      tbody.addEventListener("click", function (e) {
        const btn = e.target.closest("[data-act]");
        if (!btn) return;
        const row = btn.closest("tr");
        const id = Number(row.getAttribute("data-id"));
        const act = btn.getAttribute("data-act");
        if (act === "del-rule") {
          if (!window.confirm("حذف هذه القاعدة؟")) return;
          client()
            .from("service_classification_rules")
            .delete()
            .eq("id", id)
            .then(function (res) {
              if (res.error) { fail("تعذّر حذف القاعدة."); return; }
              ok("تم حذف القاعدة.");
              loadRules();
            });
        } else if (act === "toggle-rule") {
          const active = btn.getAttribute("data-active") === "1";
          client()
            .from("service_classification_rules")
            .update({ is_active: !active })
            .eq("id", id)
            .then(function (res) {
              if (res.error) { fail("تعذّر تحديث القاعدة."); return; }
              loadRules();
            });
        }
      });
    }
  }


  function saveService(id, row) {
    const original = servicesMap[id] || {};
    const platformEl = row.querySelector(".js-platform");
    const platform = platformEl ? platformEl.value : null;
    const platformChanged = platform && String(platform) !== String(original.platform || "other");
    const patch = {
      rate: Number(row.querySelector(".js-rate").value),
      markup: Number(row.querySelector(".js-markup").value) || 0,
      is_active: row.querySelector(".js-active").checked,
    };
    const btn = row.querySelector('[data-act="save-service"]');
    if (btn) { btn.disabled = true; btn.textContent = "جارٍ الحفظ…"; }
    const c = client();
    const platformTask = platformChanged
      ? c.rpc("set_service_platform", { p_service_id: Number(id), p_platform: platform })
      : Promise.resolve({ data: { ok: true } });

    platformTask
      .then(function (res) {
        if (res.error) {
          throw new Error(
            /function|schema|does not exist/i.test(String(res.error.message || ""))
              ? "تصنيف المنصة غير مهيأ بعد. طبّق ملف الهجرة (migration)."
              : (res.error.message || "تعذّر حفظ التصنيف.")
          );
        }
        if (res.data && res.data.ok === false) {
          throw new Error(res.data.error || "تعذّر حفظ التصنيف.");
        }
        return c.from("services").update(patch).eq("id", id);
      })
      .then(function (res) {
        if (res.error) throw new Error("تعذّر حفظ الخدمة.");
        if (platformChanged) {
          original.platform = platform;
          original.platform_source = "manual";
        }
        ok("تم حفظ الخدمة.");
        if (btn) { btn.disabled = false; btn.textContent = "حفظ"; }
      })
      .catch(function (err) {
        fail(err && err.message ? err.message : "تعذّر حفظ الخدمة.");
        if (btn) { btn.disabled = false; btn.textContent = "حفظ"; }
      });
  }

  function deleteService(id) {
    if (!window.confirm("حذف هذه الخدمة؟")) return;
    client()
      .from("services")
      .delete()
      .eq("id", id)
      .then(function (res) {
        if (res.error) { fail("تعذّر حذف الخدمة."); return; }
        ok("تم حذف الخدمة.");
        services();
      });
  }

  function syncServices(btn, providerId) {
    const c = client();
    if (!c) { fail("الاتصال غير جاهز."); return; }
    const original = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "جارٍ المزامنة…";
    }
    function restore() {
      if (!btn) return;
      btn.disabled = false;
      btn.innerHTML = original;
      if (window.Icons && window.Icons.hydrateIcons) window.Icons.hydrateIcons(btn);
    }
    const payload = providerId ? { provider_id: providerId } : {};
    c.functions
      .invoke("sync-services", { body: payload })
      .then(function (res) {
        if (res.error) { fail("تعذّرت المزامنة. تأكّد من رابط الـAPI والمفتاح."); return; }
        const data = res.data || {};
        const results = Array.isArray(data.results) ? data.results : [];
        const bad = results.filter(function (r) { return !r.ok; })[0];
        if (!data.ok) {
          fail(bad ? "تعذّرت المزامنة: " + (bad.error || "خطأ") : "تعذّرت المزامنة.");
          return;
        }
        let inserted = 0;
        let updated = 0;
        results.forEach(function (r) {
          inserted += r.inserted || 0;
          updated += r.updated || 0;
        });
        ok("تمت المزامنة: " + inserted + " خدمة جديدة، " + updated + " محدّثة.");
        if (pageKey() === "services") services();
      })
      .catch(function () {
        fail("تعذّرت المزامنة. تحقّق من الاتصال.");
      })
      .then(restore);
  }

  /* ——— الطلبات ——— */
  function orders() {
    const c = client();
    const tbody = el("orders-body");
    if (!tbody) return;
    c.from("orders")
      .select("id, user_id, service_id, service_name, quantity, charge, status, target, created_at")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(function (res) {
        const rows = (res && res.data) || [];
        if (!rows.length) {
          tbody.innerHTML = '<tr><td colspan="7">لا توجد طلبات بعد.</td></tr>';
          return;
        }
        tbody.innerHTML = rows
          .map(function (o) {
            const svc = servicesMap[o.service_id];
            const options = Object.keys(ORDER_STATUS)
              .map(function (k) {
                return '<option value="' + k + '"' + (o.status === k ? " selected" : "") + ">" + ORDER_STATUS[k] + "</option>";
              })
              .join("");
            return (
              '<tr data-id="' + o.id + '">' +
              "<td>" + o.id + "</td>" +
              "<td>" + escapeHtml(userEmail(o.user_id)) + "</td>" +
              "<td>" + escapeHtml(o.service_name || (svc ? svc.name : "—")) + "</td>" +
              "<td>" + o.quantity + "</td>" +
              "<td>" + fmt(o.charge) + "</td>" +
              '<td dir="ltr" style="max-width:200px;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(o.target) + "</td>" +
              '<td><select class="select js-order-status">' +
              Object.keys(ORDER_STATUS).map(function (k) {
                return '<option value="' + k + '"' + (o.status === k ? " selected" : "") + ">" + ORDER_STATUS[k] + "</option>";
              }).join("") +
              "</select></td>" +
              "</tr>"
            );
          })
          .join("");
      });
  }

  function updateOrderStatus(id, status) {
    client()
      .from("orders")
      .update({ status: status })
      .eq("id", id)
      .then(function (res) {
        if (res.error) { fail("تعذّر تحديث حالة الطلب."); return; }
        ok("تم تحديث حالة الطلب.");
      });
  }

  /* ——— الاستلامات (recharges) ——— */
  function recharges() {
    const c = client();
    const tbody = el("recharges-body");
    if (!tbody) return;
    c.from("recharges")
      .select("id, user_id, company, sender_phone, amount, status, credited, created_at")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(function (res) {
        if (res.error) {
          tbody.innerHTML = '<tr><td colspan="8">تعذّر تحميل الاستلامات.</td></tr>';
          return;
        }
        const rows = res.data || [];
        if (!rows.length) {
          tbody.innerHTML = '<tr><td colspan="8">لا توجد استلامات بعد.</td></tr>';
          return;
        }
        tbody.innerHTML = rows
          .map(function (r) {
            const meta = RECHARGE_STATUS[r.status] || { label: r.status, cls: "badge--muted" };
            const credited = r.credited
              ? '<span class="badge badge--success">نعم</span>'
              : '<span class="badge badge--muted">لا</span>';
            const dis = r.credited ? " disabled" : "";
            return (
              '<tr data-id="' + r.id + '">' +
              "<td>" + r.id + "</td>" +
              "<td>" + escapeHtml(userEmail(r.user_id)) + "</td>" +
              "<td>" + (COMPANY_LABEL[r.company] || r.company) + "</td>" +
              '<td dir="ltr">' + escapeHtml(r.sender_phone) + "</td>" +
              "<td>" + fmt(r.amount) + "</td>" +
              '<td><span class="badge ' + meta.cls + '">' + meta.label + "</span></td>" +
              "<td>" + credited + "</td>" +
              "<td>" +
              '<button class="btn btn--primary btn--sm" type="button" data-act="approve"' + dis + ">اعتماد</button> " +
              '<button class="btn btn--outline btn--sm" type="button" data-act="review"' + dis + ">مراجعة</button> " +
              '<button class="btn btn--ghost btn--sm" type="button" data-act="reject"' + dis + ">رفض</button>" +
              "</td>" +
              "</tr>"
            );
          })
          .join("");
      });
  }

  function rechargeAction(id, action) {
    const labels = {
      approve: "اعتماد الاستلام وإضافة الرصيد",
      review: "تحويل الاستلام إلى مراجعة",
      reject: "رفض الاستلام",
    };
    if (!window.confirm("تأكيد: " + (labels[action] || action) + "؟")) return;
    client()
      .rpc("admin_recharge_action", { p_id: Number(id), p_action: action })
      .then(function (res) {
        if (res.error || (res.data && res.data.ok === false)) {
          fail("تعذّر تنفيذ العملية.");
          return;
        }
        ok("تم تحديث الاستلام.");
        recharges();
      });
  }

  /* ——— الإعدادات: أرقام الاستقبال ——— */
  function settings() {
    const c = client();
    const tbody = el("receivers-body");
    if (!tbody) return;
    c.from("wallet_receivers")
      .select("id, company, phone, is_active, sort_order")
      .order("company", { ascending: true })
      .order("sort_order", { ascending: true })
      .then(function (res) {
        if (res.error) {
          tbody.innerHTML = '<tr><td colspan="5">تعذّر تحميل الأرقام.</td></tr>';
          return;
        }
        const rows = res.data || [];
        if (!rows.length) {
          tbody.innerHTML = '<tr><td colspan="5">لا توجد أرقام استقبال بعد.</td></tr>';
          return;
        }
        tbody.innerHTML = rows
          .map(function (r) {
            return (
              '<tr data-id="' + r.id + '">' +
              "<td>" + (COMPANY_LABEL[r.company] || r.company) + "</td>" +
              '<td><input class="input js-phone" type="tel" dir="ltr" style="max-width:150px" value="' + escapeHtml(r.phone) + '" /></td>' +
              '<td><input class="input js-sort" type="number" step="1" dir="ltr" style="max-width:80px" value="' + (r.sort_order == null ? 0 : r.sort_order) + '" /></td>' +
              '<td><input type="checkbox" class="js-active" ' + (r.is_active ? "checked" : "") + " /></td>" +
              "<td>" +
              '<button class="btn btn--outline btn--sm" type="button" data-act="save-receiver">حفظ</button> ' +
              '<button class="btn btn--ghost btn--sm" type="button" data-act="del-receiver">حذف</button>' +
              "</td>" +
              "</tr>"
            );
          })
          .join("");
      });
  }

  function addReceiver(form) {
    const company = el("rcv-company").value;
    const phone = el("rcv-phone").value.trim();
    if (window.Validators && window.Validators.lyPhone(phone) !== true) {
      window.UI.toast("أدخل رقمًا ليبيًا صحيحًا يبدأ بـ 09 (10 أرقام).", { type: "warning" });
      return;
    }
    client()
      .from("wallet_receivers")
      .insert({ company: company, phone: phone, is_active: true, sort_order: 0 })
      .then(function (res) {
        if (res.error) { fail("تعذّر إضافة الرقم."); return; }
        el("receiver-form").reset();
        ok("تمت إضافة رقم الاستقبال.");
        settings();
      });
  }

  function saveReceiver(id, row) {
    const phone = row.querySelector(".js-phone").value.trim();
    if (window.Validators && window.Validators.lyPhone(phone) !== true) {
      window.UI.toast("رقم غير صحيح.", { type: "warning" });
      return;
    }
    const patch = {
      phone: phone,
      sort_order: Number(row.querySelector(".js-sort").value) || 0,
      is_active: row.querySelector(".js-active").checked,
    };
    client()
      .from("wallet_receivers")
      .update(patch)
      .eq("id", id)
      .then(function (res) {
        if (res.error) { fail("تعذّر حفظ الرقم."); return; }
        ok("تم حفظ الرقم.");
      });
  }

  function deleteReceiver(id) {
    if (!window.confirm("حذف رقم الاستقبال هذا؟")) return;
    client()
      .from("wallet_receivers")
      .delete()
      .eq("id", id)
      .then(function (res) {
        if (res.error) { fail("تعذّر حذف الرقم."); return; }
        ok("تم حذف الرقم.");
        settings();
      });
  }

  /* ——— تغيير كلمة المرور ——— */
  function changePassword(form) {
    const pwd = (el("pwd-new") || {}).value || "";
    const conf = (el("pwd-confirm") || {}).value || "";
    if (pwd.length < 6) {
      window.UI.toast("كلمة المرور يجب أن تكون 6 أحرف على الأقل.", { type: "warning" });
      return;
    }
    if (pwd !== conf) {
      window.UI.toast("كلمتا المرور غير متطابقتين.", { type: "warning" });
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    setBtnLoading(btn, true);
    client()
      .auth.updateUser({ password: pwd })
      .then(function (res) {
        setBtnLoading(btn, false);
        if (res.error) { fail("تعذّر تغيير كلمة المرور."); return; }
        form.reset();
        ok("تم تغيير كلمة المرور.");
      })
      .catch(function () {
        setBtnLoading(btn, false);
        fail("تعذّر تغيير كلمة المرور.");
      });
  }

  /* ——— ربط SMS RAEED ——— */
  function setBtnLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      btn.classList.add("is-loading");
    } else {
      btn.disabled = false;
      btn.classList.remove("is-loading");
    }
  }

  function applySmsraedStatus(s) {
    const base = el("smsraed-base");
    if (base && s.base_url) base.value = s.base_url;
    const en = el("smsraed-enabled");
    if (en) en.checked = !!s.enabled;
    const keyState = el("smsraed-key-state");
    if (keyState) {
      keyState.innerHTML = s.key_set
        ? '<span class="badge badge--success">المفتاح مضبوط ••••' +
          escapeHtml(s.key_hint || "") +
          "</span>"
        : '<span class="badge badge--danger">لا يوجد مفتاح</span>';
    }
    const enState = el("smsraed-enabled-state");
    if (enState) {
      enState.innerHTML = s.enabled
        ? '<span class="badge badge--success">مفعّل</span>'
        : '<span class="badge badge--muted">معطّل</span>';
    }
  }

  function refreshSmsraed() {
    client()
      .rpc("admin_smsraed_status")
      .then(function (res) {
        if (res.error || !res.data || res.data.ok === false) {
          fail("تعذّر جلب حالة الربط.");
          return;
        }
        applySmsraedStatus(res.data);
      });
  }

  function saveSmsraed(form) {
    const key = el("smsraed-key").value.trim();
    const base = el("smsraed-base").value.trim();
    const enabled = el("smsraed-enabled").checked;
    const btn = form.querySelector('button[type="submit"]');
    setBtnLoading(btn, true);
    client()
      .rpc("admin_smsraed_save", {
        p_api_key: key || null,
        p_base_url: base || null,
        p_enabled: enabled,
      })
      .then(function (res) {
        setBtnLoading(btn, false);
        if (res.error || !res.data || res.data.ok === false) {
          fail("تعذّر حفظ إعدادات الربط.");
          return;
        }
        el("smsraed-key").value = "";
        applySmsraedStatus(res.data);
        ok("تم حفظ إعدادات ربط SMS RAEED.");
      });
  }

  function clearSmsraedKey() {
    if (!window.confirm("مسح مفتاح SMS RAEED؟ لن يعمل الشحن حتى تضيف مفتاحًا جديدًا.")) return;
    client()
      .rpc("admin_smsraed_clear_key")
      .then(function (res) {
        if (res.error || !res.data || res.data.ok === false) {
          fail("تعذّر مسح المفتاح.");
          return;
        }
        applySmsraedStatus(res.data);
        ok("تم مسح المفتاح.");
      });
  }

  function testSmsraed() {
    const box = el("smsraed-test-result");
    if (box) box.textContent = "جارٍ اختبار الاتصال…";
    client()
      .rpc("admin_smsraed_test")
      .then(function (res) {
        if (res.error || !res.data || res.data.ok === false) {
          const code = res.data && res.data.error;
          if (box) box.textContent = code === "not_configured" ? "لا يوجد مفتاح مخزَّن." : "تعذّر بدء الاختبار.";
          return;
        }
        const rid = res.data.request_id;
        let tries = 0;
        const timer = setInterval(function () {
          tries++;
          client()
            .rpc("admin_smsraed_test_result", { p_id: rid })
            .then(function (r2) {
              if (r2 && r2.data && r2.data.found) {
                clearInterval(timer);
                if (box) {
                  box.textContent =
                    "رمز HTTP: " + r2.data.status_code + "\n" + (r2.data.body || "").slice(0, 400);
                }
              } else if (tries >= 8) {
                clearInterval(timer);
                if (box) box.textContent = "لم يصل رد بعد. تحقّق من الرابط والمفتاح والحساب على منصة SMS RAEED.";
              }
            });
        }, 700);
      });
  }

  /* ——— ربط الأحداث ——— */
  function wire() {
    const key = pageKey();

    if (key === "smsraed") {
      const form = el("smsraed-form");
      if (form) {
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          saveSmsraed(form);
        });
      }
      const clear = el("smsraed-clear");
      if (clear) clear.addEventListener("click", clearSmsraedKey);
      const test = el("smsraed-test");
      if (test) test.addEventListener("click", testSmsraed);
    }

    if (key === "providers") {
      const form = el("provider-form");
      if (form) {
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          addProvider(form);
        });
      }
      const sync = el("providers-sync");
      if (sync) {
        sync.addEventListener("click", function () {
          syncServices(sync);
        });
      }
      const tbody = el("providers-body");
      if (tbody) {
        tbody.addEventListener("click", function (e) {
          const btn = e.target.closest("[data-act]");
          if (!btn) return;
          const row = btn.closest("tr");
          const id = Number(row.getAttribute("data-id"));
          if (btn.getAttribute("data-act") === "save-provider") saveProvider(id, row);
          else if (btn.getAttribute("data-act") === "del-provider") deleteProvider(id);
        });
      }
    }

    if (key === "users") {
      const tbody = el("users-body");
      if (tbody) {
        tbody.addEventListener("click", function (e) {
          const btn = e.target.closest('[data-act="adjust"]');
          if (!btn) return;
          const row = btn.closest("tr");
          adjustBalance(row.getAttribute("data-id"), row.querySelector(".js-amount").value);
        });
      }
    }

    if (key === "services") {
      const tbody = el("services-body");
      if (tbody) {
        tbody.addEventListener("click", function (e) {
          const btn = e.target.closest("[data-act]");
          if (!btn) return;
          const row = btn.closest("tr");
          const id = Number(row.getAttribute("data-id"));
          if (btn.getAttribute("data-act") === "save-service") saveService(id, row);
          else if (btn.getAttribute("data-act") === "del-service") deleteService(id);
        });
      }
      const sync = el("services-sync");
      if (sync) {
        sync.addEventListener("click", function () {
          syncServices(sync);
        });
      }
      servicesPage = 1;
      loadServiceCategoryOptions();
      loadServiceProviderOptions();
      initPlatformSelects();
      wireServicesFilters();
      wireBulkActions();
      wireRules();
      loadRules();
    }

    if (key === "orders") {
      const tbody = el("orders-body");
      if (tbody) {
        tbody.addEventListener("change", function (e) {
          const sel = e.target.closest(".js-order-status");
          if (!sel) return;
          updateOrderStatus(Number(sel.closest("tr").getAttribute("data-id")), sel.value);
        });
      }
    }

    if (key === "recharges") {
      const tbody = el("recharges-body");
      if (tbody) {
        tbody.addEventListener("click", function (e) {
          const btn = e.target.closest("[data-act]");
          if (!btn || btn.disabled) return;
          const act = btn.getAttribute("data-act");
          if (act === "approve" || act === "review" || act === "reject") {
            rechargeAction(Number(btn.closest("tr").getAttribute("data-id")), act);
          }
        });
      }
    }

    if (key === "settings") {
      const form = el("receiver-form");
      if (form) {
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          addReceiver(form);
        });
      }
      const pwdForm = el("password-form");
      if (pwdForm) {
        pwdForm.addEventListener("submit", function (e) {
          e.preventDefault();
          changePassword(pwdForm);
        });
      }
      const tbody = el("receivers-body");
      if (tbody) {
        tbody.addEventListener("click", function (e) {
          const btn = e.target.closest("[data-act]");
          if (!btn) return;
          const row = btn.closest("tr");
          const id = Number(row.getAttribute("data-id"));
          if (btn.getAttribute("data-act") === "save-receiver") saveReceiver(id, row);
          else if (btn.getAttribute("data-act") === "del-receiver") deleteReceiver(id);
        });
      }
    }
  }

  const MODULES = {
    dashboard: dashboard,
    users: users,
    providers: providers,
    services: services,
    orders: orders,
    recharges: recharges,
    settings: settings,
    smsraed: refreshSmsraed,
  };

  function loadProfiles() {
    return client()
      .from("profiles")
      .select("id, email, full_name")
      .then(function (res) {
        ((res && res.data) || []).forEach(function (p) {
          profilesMap[p.id] = p;
        });
      })
      .catch(function () {});
  }

  function start() {
    if (started) return;
    started = true;
    buildShell();
    wire();
    guard().then(function (allowed) {
      if (!allowed) return;
      loadProfiles().then(function () {
        const run = MODULES[pageKey()];
        if (run) run();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", buildShell);
  document.addEventListener("session:changed", start);
})();
