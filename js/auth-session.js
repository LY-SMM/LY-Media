/*
  auth-session.js
  حالة تسجيل الدخول المشتركة بين كل الصفحات.

  مسؤوليات هذا الملف:
  - معرفة ما إذا كان هناك جلسة نشطة (عبر عميل Supabase).
  - تمييز دور المستخدم (user / admin) عبر window.AppSession.role.
  - تحويل روابط الدخول في الترويسة إلى هوية المستخدم مع زر خروج.
  - حماية الصفحات الخاصة وإعادة التوجيه حسب الدور:
      • زائر غير مسجّل → login.html
      • مشرف على صفحات العميل → admin/index.html
      • عميل داخل منطقة admin/ → wallet.html
  - تزويذ باقي الوحدات بجلسة المستخدم عبر window.AppSession.

  لا يُنفّذ تسجيل الدخول أو إنشاء الحساب هنا؛ ذلك في auth.js.
*/

(function () {
  "use strict";

  const PRIVATE_PAGES = ["wallet.html", "settings.html"];
  const AUTH_PAGES = ["login.html", "register.html"];

  window.AppSession = {
    user: null,
    session: null,
    role: null,
    ready: false,
  };

  /* ——— أدوات المسار ——— */
  function pageName() {
    return location.pathname.split("/").pop() || "index.html";
  }
  function inAdmin() {
    return /\/admin(\/|$)/.test(location.pathname);
  }
  function base() {
    return inAdmin() ? "../" : "";
  }
  function isPrivatePage() {
    return inAdmin() || PRIVATE_PAGES.indexOf(pageName()) !== -1;
  }

  function displayName(user) {
    if (!user) return "";
    const meta =
      (user.user_metadata && user.user_metadata.full_name) ||
      (user.user_metadata && user.user_metadata.name);
    if (meta) return meta;
    if (user.email) return user.email;
    return "حسابك";
  }

  /* ——— تحديث الترويسة ——— */
  function renderNav(state) {
    const actions = document.querySelector(".nav__actions");
    if (!actions) return;

    if (!state.authenticated) {
      actions.removeAttribute("data-auth");
      actions.innerHTML =
        '<a class="btn btn--ghost" href="' + base() + 'login.html">تسجيل الدخول</a>' +
        '<a class="btn btn--primary" href="' + base() + 'register.html">إنشاء حساب</a>';
      return;
    }

    actions.setAttribute("data-auth", "in");
    actions.innerHTML = "";

    const account = document.createElement("a");
    account.className = "btn btn--ghost nav__account";
    account.href = base() + "settings.html";
    account.innerHTML = "";
    const icon = document.createElement("span");
    icon.setAttribute("data-icon", "user");
    icon.setAttribute("data-icon-size", "18");
    const label = document.createElement("span");
    label.textContent = displayName(state.user);
    account.appendChild(icon);
    account.appendChild(label);

    const out = document.createElement("button");
    out.className = "btn btn--outline nav__logout";
    out.type = "button";
    out.innerHTML = "";
    const outIcon = document.createElement("span");
    outIcon.setAttribute("data-icon", "logout");
    outIcon.setAttribute("data-icon-size", "18");
    const outLabel = document.createElement("span");
    outLabel.textContent = "خروج";
    out.appendChild(outIcon);
    out.appendChild(outLabel);

    actions.appendChild(account);
    actions.appendChild(out);

    if (window.Icons && window.Icons.hydrateIcons) {
      window.Icons.hydrateIcons(actions);
    }
  }

  /* ——— إظهار/إخفاء العناصر حسب حالة الدخول ——— */
  function applyAuthVisibility(authenticated) {
    document.querySelectorAll("[data-guest-only]").forEach(function (el) {
      el.hidden = authenticated;
    });
    document.querySelectorAll("[data-auth-only]").forEach(function (el) {
      el.hidden = !authenticated;
    });
  }

  /* ——— رابط الإدارة في الترويسة (للمشرف فقط) ——— */
  function syncAdminLink() {
    const links = document.querySelector(".nav__links");
    if (!links) return;
    const existing = links.querySelector('[data-auth="admin"]');
    if (existing) existing.remove();
    if (!window.AppSession.session || window.AppSession.role !== "admin") return;

    const a = document.createElement("a");
    a.className = "nav__link";
    a.setAttribute("data-auth", "admin");
    a.href = base() + "admin/index.html";
    a.textContent = "الإدارة";
    links.appendChild(a);
  }

  /* ——— جلب الدور ——— */
  function resolveRole(session) {
    const c = window.SupabaseClient;
    if (!session || !c) {
      window.AppSession.role = null;
      return Promise.resolve(null);
    }
    return c
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(function (res) {
        window.AppSession.role = res && res.data ? res.data.role : null;
        return window.AppSession.role;
      })
      .catch(function () {
        window.AppSession.role = null;
        return null;
      });
  }

  /* ——— توجيه حسب الحالة والدور ——— */
  function route() {
    const session = window.AppSession.session;
    const name = pageName();

    if (!session) {
      if (isPrivatePage()) location.replace(base() + "login.html");
      return;
    }

    if (window.AppSession.role === "admin") {
      if (inAdmin()) return;
      if (PRIVATE_PAGES.indexOf(name) !== -1 || AUTH_PAGES.indexOf(name) !== -1) {
        location.replace(base() + "admin/index.html");
      }
      return;
    }

    if (inAdmin()) location.replace("../wallet.html");
  }

  /* ——— تسجيل الخروج ——— */
  function signOut() {
    const c = window.SupabaseClient;
    const finish = function () {
      window.AppSession.user = null;
      window.AppSession.session = null;
      window.AppSession.role = null;
      renderNav({ authenticated: false });
      syncAdminLink();
      applyAuthVisibility(false);
      if (window.UI) {
        window.UI.toast("تم تسجيل الخروج من حسابك.", { type: "info", title: "خروج" });
      }
      location.replace(base() + "login.html");
    };
    if (!c || !c.auth) {
      finish();
      return;
    }
    c.auth.signOut().then(finish).catch(finish);
  }

  /* ——— مزامنة كاملة بعد معرفة الجلسة ——— */
  function apply(session) {
    window.AppSession.session = session || null;
    window.AppSession.user = session ? session.user : null;
    window.AppSession.ready = true;
    return resolveRole(session).then(function () {
      renderNav({ authenticated: Boolean(session), user: session && session.user });
      syncAdminLink();
      applyAuthVisibility(Boolean(session));
      route();
      document.dispatchEvent(
        new CustomEvent("session:changed", { detail: window.AppSession })
      );
    });
  }

  /* ——— بدء التتبع ——— */
  function start() {
    const c = window.SupabaseClient;
    if (!c || !c.auth) return;
    c.auth.getSession().then(function (res) {
      apply(res && res.data ? res.data.session : null);
    });
    c.auth.onAuthStateChange(function (_event, session) {
      apply(session);
    });
  }

  document.addEventListener("supabase:ready", start);
  document.addEventListener("supabase:unavailable", function () {
    window.AppSession.ready = true;
    renderNav({ authenticated: false });
    syncAdminLink();
    applyAuthVisibility(false);
    route();
    document.dispatchEvent(
      new CustomEvent("session:changed", { detail: window.AppSession })
    );
  });

  window.AppAuth = { signOut: signOut, displayName: displayName, base: base };
})();
