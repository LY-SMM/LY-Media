/*
  settings.js
  منطق صفحة الإعدادات.

  تغيير الواجهة (فاتح/داكن) محلي فقط. نموذج معلومات الحساب يعرض بيانات
  الجلسة الحقيقية ويحفظ الاسم الظاهر عبر خدمة المصادقة.
*/

(function () {
  "use strict";

  const THEME_KEY = "libyago-theme";

  /* ——— السمة (فاتح/داكن) ——— */
  function initThemeToggle() {
    const toggle = document.getElementById("theme-toggle");
    if (!toggle) return;

    // مزامنة الحالة مع السمة الحالية
    let current = "light";
    try {
      current = localStorage.getItem(THEME_KEY) || "light";
    } catch (e) {}
    const isDark = current === "dark";
    toggle.checked = isDark;
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "dark" : "light"
    );

    toggle.addEventListener("change", function () {
      const theme = toggle.checked ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", theme);
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (e) {}
      window.UI.toast(
        theme === "dark" ? "تم تفعيل الوضع الداكن." : "تم تفعيل الوضع الفاتح.",
        { type: "success", duration: 2500 }
      );
    });
  }

  /* ——— حفظ معلومات الحساب ——— */
  function initAccountForm() {
    const form = document.getElementById("account-form");
    if (!form) return;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const client = window.SupabaseClient;
      const name = document.getElementById("account-name");
      const btn = form.querySelector('button[type="submit"]');
      if (!client || !client.auth || !name) return;

      const fullName = name.value.trim();
      if (!fullName) {
        window.UI.toast("أدخل اسمًا صالحًا أولًا.", { type: "warning" });
        name.focus();
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.classList.add("is-loading");
        btn.setAttribute("aria-busy", "true");
      }

      try {
        const res = await client.auth.updateUser({
          data: { full_name: fullName },
        });
        if (res && res.error) {
          window.UI.toast("تعذّر حفظ التغييرات، حاول مرة أخرى.", {
            type: "danger",
            title: "لم يتم الحفظ",
          });
        } else {
          window.UI.toast("تم حفظ التغييرات.", { type: "success" });
        }
      } catch (err) {
        window.UI.toast("تعذّر حفظ التغييرات، تحقّق من الاتصال.", {
          type: "danger",
          title: "لم يتم الحفظ",
        });
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.classList.remove("is-loading");
          btn.removeAttribute("aria-busy");
        }
      }
    });
  }

  /* ——— معلومات الحساب من الجلسة الحقيقية ——— */
  function renderAccount(session) {
    const name = document.getElementById("account-name");
    const email = document.getElementById("account-email");
    const uid = document.getElementById("account-uid");
    const created = document.getElementById("account-created");
    const status = document.getElementById("account-status");
    if (!name || !email) return;

    const user = session ? session.user : null;
    if (!user) {
      name.value = "";
      email.value = "";
      if (uid) uid.textContent = "—";
      if (created) created.textContent = "—";
      return;
    }

    const meta = user.user_metadata || {};
    name.value = meta.full_name || meta.name || "";
    email.value = user.email || "";
    if (uid) uid.textContent = user.id || "—";
    if (created) {
      created.textContent = user.created_at
        ? String(user.created_at).slice(0, 10)
        : "—";
    }
    if (status) {
      const confirmed =
        user.email_confirmed_at || user.confirmed_at || null;
      status.innerHTML = confirmed
        ? '<span class="badge badge--success">مؤكَّد</span>'
        : '<span class="badge badge--warning">بانتظار التأكيد</span>';
    }
  }

  /* ——— تسجيل الخروج ——— */
  function initLogout() {
    const btn = document.getElementById("logout-btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (window.AppAuth) window.AppAuth.signOut();
    });
  }

  /* ——— تعبئة نموذج الحساب عند توفّر الجلسة ——— */
  function initAccountSession() {
    renderAccount(window.AppSession && window.AppSession.session);
    document.addEventListener("session:changed", function (e) {
      renderAccount(e.detail ? e.detail.session : null);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initThemeToggle();
    initAccountForm();
    initAccountSession();
    initLogout();
  });
})();
