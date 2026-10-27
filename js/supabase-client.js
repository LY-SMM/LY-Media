/*
  supabase-client.js
  تهيئة عميل Supabase المشترك بين الصفحات.

  يُحمّل مكتبة supabase-js من الشبكة التوزيعية كوحدة ES، وينشر الناتج على
  window.SupabaseClient. إذا تعذّر التحميل (انقطاع الشبكة أو حظر الـ CDN)
  يبقى الكائن null وتتعامل بقية الصفحات مع ذلك دون تعطّل الواجهة.

  تخزين الجلسة يتبع مفضّلة "تذكّرني" في صفحة الدخول:
  - عند التفعيل تُحفظ الجلسة في localStorage فتبقى بعد إغلاق المتصفح.
  - عند التعطيل تُحفظ في sessionStorage، فتبقى بين صفحات الموقع في نفس
    التبويب لكنها تنتهي بإغلاق المتصفح.
  القراءة تتحقّق من المخزن المفضّل لحظة الاستدعاء وتسقط إلى المخزن الآخر،
  لتجنّب حالة تسجيل دخول قديمة في مخزن لم يعد هو المفضّل.
*/

(function () {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const REMEMBER_KEY = "libyago-remember-session";

  window.SupabaseClient = null;
  window.SupabaseClientReady = false;

  function wantsRemember() {
    try {
      return localStorage.getItem(REMEMBER_KEY) === "1";
    } catch (err) {
      return false;
    }
  }

  function primaryStore() {
    return wantsRemember() ? window.localStorage : window.sessionStorage;
  }

  function secondaryStore() {
    return wantsRemember() ? window.sessionStorage : window.localStorage;
  }

  // مخزن ديناميكي: يختار المخزن حسب المفضّلة الحالية في لحظة الاستدعاء.
  function dynamicStorage() {
    return {
      getItem: function (key) {
        let value = null;
        try {
          value = primaryStore().getItem(key);
        } catch (err) {
          value = null;
        }
        if (value === null) {
          try {
            value = secondaryStore().getItem(key);
          } catch (err2) {
            value = null;
          }
        }
        return value;
      },
      setItem: function (key, value) {
        try {
          primaryStore().setItem(key, value);
        } catch (err) {
          /* التخزين ممتلئ أو محظور — نتجاهل */
        }
      },
      removeItem: function (key) {
        try {
          window.localStorage.removeItem(key);
        } catch (err) {
          /* تجاهل */
        }
        try {
          window.sessionStorage.removeItem(key);
        } catch (err2) {
          /* تجاهل */
        }
      },
    };
  }

  function init(client) {
    window.SupabaseClient = client;
    window.SupabaseClientReady = true;
    document.dispatchEvent(
      new CustomEvent("supabase:ready", { detail: client })
    );
  }

  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
    document.dispatchEvent(
      new CustomEvent("supabase:unavailable", {
        detail: { reason: "missing-config" },
      })
    );
    return;
  }

  import("https://esm.sh/@supabase/supabase-js@2")
    .then(function (mod) {
      const createClient =
        mod.createClient || (mod.default && mod.default.createClient);
      if (typeof createClient !== "function") {
        throw new Error("createClient غير متاح من الوحدة المحملة.");
      }
      init(
        createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: "libyago-auth",
            storage: dynamicStorage(),
          },
        })
      );
    })
    .catch(function (err) {
      document.dispatchEvent(
        new CustomEvent("supabase:unavailable", {
          detail: { reason: "load-failed", error: err },
        })
      );
    });
})();
