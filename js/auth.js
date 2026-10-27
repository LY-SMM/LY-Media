/*
  auth.js
  الدخول وإنشاء الحساب عبر حساب Google فقط (Supabase OAuth).

  لا توجد نماذج بريد أو كلمة مرور: زر واحد يبدأ تدفّق OAuth لدى Supabase،
  ويعود بعدها المستخدم إلى صفحة المحفظة بجلسة جاهزة. الحساب يُنشأ تلقائيًا
  عند أول دخول.
*/

(function () {
  "use strict";

  const REDIRECT_AFTER_LOGIN = "wallet.html";
  const PROVIDER = "google";

  const V = window.Validators;
  const H = window.FormHelpers;

  /* مفتاح مفضّلة "تذكّرني" الذي يقرأه supabase-client.js لاختيار مخزن الجلسة. */
  const REMEMBER_KEY = "libyago-remember-session";

  function rememberField() {
    return document.getElementById("remember-me");
  }

  /* يثبّت المفضّلة الحالية قبل بدء الدخول حتى تُحفظ الجلسة في المخزن الصحيح. */
  function applyRememberChoice() {
    const el = rememberField();
    if (!el) return;
    try {
      localStorage.setItem(REMEMBER_KEY, el.checked ? "1" : "0");
    } catch (err) {
      /* التخزين محظور — نتجاهل */
    }
  }

  /* يعيد ضبط المربّع حسب المفضّلة المحفوظة (المضبوط افتراضيًا على التذكّر). */
  function initRememberField() {
    const el = rememberField();
    if (!el) return;
    try {
      el.checked = localStorage.getItem(REMEMBER_KEY) !== "0";
    } catch (err) {
      /* تجاهل */
    }
  }

  /* يعمل مع النطاق الجذري وأيضًا مع النشر داخل مجلد فرعي (مثل GitHub Pages). */
  function redirectUrl(page) {
    return new URL(page, location.href).href;
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.classList.add("is-loading");
      btn.setAttribute("aria-busy", "true");
      btn.disabled = true;
    } else {
      btn.classList.remove("is-loading");
      btn.removeAttribute("aria-busy");
      btn.disabled = false;
    }
  }

  function authUnavailableToast() {
    window.UI.toast(
      "تعذّر الاتصال بخدمة المصادقة. تأكد من اتصالك بالإنترنت ثم أعد تحميل الصفحة.",
      { type: "danger", title: "تعذّر الاتصال", duration: 7000 }
    );
  }

  function startGoogleAuth(btn) {
    const client = window.SupabaseClient;
    if (!client || !client.auth) {
      authUnavailableToast();
      return;
    }

    setLoading(btn, true);
    applyRememberChoice();
    const redirectTo = redirectUrl(REDIRECT_AFTER_LOGIN);

    client.auth
      .signInWithOAuth({
        provider: PROVIDER,
        options: { redirectTo: redirectTo },
      })
      .then(function (res) {
        if (res && res.error) {
          setLoading(btn, false);
          window.UI.toast(
            "تعذّر بدء الدخول عبر Google. حاول مرة أخرى بعد قليل.",
            { type: "danger", title: "تعذّر الدخول", duration: 7000 }
          );
        }
        // عند النجاح ينتقل المتصفح إلى Google مباشرة، فلا حاجة لإجراء آخر.
      })
      .catch(function () {
        setLoading(btn, false);
        authUnavailableToast();
      });
  }

  function bindGoogleButton(id) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener("click", function () {
      startGoogleAuth(btn);
    });
  }

  /* ——— الدخول بالبريد وكلمة المرور ——— */
  function bindEmailLogin() {
    const form = document.getElementById("email-login");
    if (!form) return;

    const email = document.getElementById("login-email");
    const password = document.getElementById("login-password");
    if (email) H.attachLiveValidation(email, [V.email]);
    if (password) H.attachLiveValidation(password, [V.required]);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const check = H.validateForm({
        "login-email": [V.email],
        "login-password": [V.required],
      });
      if (!check.valid) {
        if (check.firstInvalid) check.firstInvalid.focus();
        return;
      }
      applyRememberChoice();
      submitEmailLogin(form, email.value.trim(), password.value);
    });
  }

  function submitEmailLogin(form, email, password) {
    const client = window.SupabaseClient;
    if (!client || !client.auth) {
      authUnavailableToast();
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    setLoading(btn, true);

    client.auth
      .signInWithPassword({ email: email, password: password })
      .then(function (res) {
        setLoading(btn, false);
        if (res && res.error) {
          window.UI.toast(
            "تعذّر تسجيل الدخول. تحقّق من البريد الإلكتروني وكلمة المرور.",
            { type: "danger", title: "فشل الدخول", duration: 6000 }
          );
          return;
        }
        window.UI.toast("تم تسجيل الدخول.", {
          type: "success",
          duration: 2000,
        });
        landingFor(client, res && res.data ? res.data.user : null);
      })
      .catch(function () {
        setLoading(btn, false);
        authUnavailableToast();
      });
  }

  /* يوجّه المشرف إلى لوحة الإدارة، والعميل إلى المحفظة. */
  function landingFor(client, user) {
    const toWallet = function () {
      location.replace(redirectUrl("wallet.html"));
    };
    if (!client || !user) {
      toWallet();
      return;
    }
    client
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
      .then(function (res) {
        if (res && res.data && res.data.role === "admin") {
          location.replace(redirectUrl("admin/index.html"));
        } else {
          toWallet();
        }
      })
      .catch(toWallet);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initRememberField();
    bindGoogleButton("google-login");
    bindGoogleButton("google-register");
    bindEmailLogin();
  });
})();
