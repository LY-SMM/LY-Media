/*
  wallet.js
  منطق صفحة المحفظة المربوط بقاعدة البيانات:

  - عرض الرصيد الحقيقي من جدول wallets.
  - عرض رقم الاستقبال حسب الشركة من جدول wallet_receivers.
  - إرسال طلب شحن حقيقي عبر الدالة recharge_start (تتحقّق من التحويل
    الخارجي على الخادم عبر خدمة المطابقة).
  - متابعة حالة الطلبات من جدول recharges وتحديث الرصيد تلقائيًا.
*/

(function () {
  "use strict";

  const V = window.Validators;
  const H = window.FormHelpers;

  const EMPTY = "—";
  const POLL_MS = 10000;

  const COMPANY_NAME = { libyana: "ليبيانا", almadar: "المدار" };

  const ERROR_TEXT = {
    not_authenticated: "انتهت الجلسة، يرجى تسجيل الدخول من جديد.",
    invalid_company: "اختر شركة التحويل بشكل صحيح.",
    invalid_phone: "رقم الهاتف غير صحيح.",
    invalid_amount: "المبلغ غير صحيح.",
    too_many_pending: "لديك طلبات شحن معلّقة كثيرة، انتظر تأكيدها أولًا.",
    no_receiver: "لا يوجد رقم استقبال متاح لهذه الشركة حاليًا.",
    not_configured: "خدمة الشحن غير مفعّلة بعد من قبل الإدارة.",
  };

  const STATUS_META = {
    pending: { label: "بانتظار التحقق", cls: "badge--pending" },
    success: { label: "ناجح", cls: "badge--success" },
    failed: { label: "فاشل", cls: "badge--failed" },
    cancelled: { label: "ملغى", cls: "badge--muted" },
    needs_review: { label: "يحتاج إلى مراجعة", cls: "badge--review" },
  };

  let receivers = { libyana: null, almadar: null };
  let knownStatus = {};
  let pollTimer = null;
  let formWired = false;
  let dataLoaded = false;

  /* ——— أدوات ——— */
  function client() {
    return window.SupabaseClient;
  }

  function uid() {
    return window.AppSession && window.AppSession.user
      ? window.AppSession.user.id
      : null;
  }

  function formatCurrency(value) {
    return Number(value || 0)
      .toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return EMPTY;
    const p = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear() +
      "/" +
      p(d.getMonth() + 1) +
      "/" +
      p(d.getDate()) +
      " " +
      p(d.getHours()) +
      ":" +
      p(d.getMinutes())
    );
  }

  /* ——— الرصيد ——— */
  function renderBalance(value) {
    const el = document.getElementById("wallet-balance");
    if (!el) return;
    el.textContent =
      value === null || value === undefined ? EMPTY : formatCurrency(value);
  }

  /* ——— رقم الاستقبال ——— */
  function renderProviderNumber(key) {
    const box = document.getElementById("pay-number");
    if (!box) return;

    const valueEl = box.querySelector("[data-pay-value]");
    const metaEl = box.querySelector("[data-pay-meta]");
    const copyBtn = box.querySelector("[data-copy-number]");
    const number = receivers[key];

    if (number) {
      valueEl.textContent = number;
      metaEl.textContent = "حوّل المبلغ إلى هذا الرقم ثم أكمل النموذج.";
      if (copyBtn) copyBtn.hidden = false;
    } else {
      valueEl.textContent = "— — — — —";
      metaEl.textContent =
        "لم يتم تحديد رقم استقبال لهذه الشركة بعد. سيضيفه فريق الإدارة قريبًا.";
      if (copyBtn) copyBtn.hidden = true;
    }
  }

  function currentCompany() {
    const form = document.getElementById("recharge-form");
    if (!form) return "libyana";
    const checked = form.querySelector('input[name="provider"]:checked');
    return checked ? checked.value : "libyana";
  }

  /* ——— سجل الطلبات ——— */
  function renderHistory(rows) {
    const tbody = document.getElementById("history-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!rows || !rows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.innerHTML =
        '<div class="empty-state"><p>لا توجد عمليات شحن حتى الآن.</p></div>';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    rows.forEach(function (r) {
      const meta = STATUS_META[r.status] || STATUS_META.pending;
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td dir="ltr" data-label="رقم العملية">#' +
        r.id +
        "</td>" +
        '<td data-label="التاريخ">' +
        formatDate(r.created_at) +
        "</td>" +
        '<td data-label="الشركة">' +
        (COMPANY_NAME[r.company] || r.company) +
        "</td>" +
        '<td dir="ltr" data-label="رقم الهاتف">' +
        (r.sender_phone || EMPTY) +
        "</td>" +
        '<td data-label="المبلغ">' +
        formatCurrency(r.amount) +
        " د.ل</td>" +
        '<td data-label="الحالة"><span class="badge ' +
        meta.cls +
        '">' +
        meta.label +
        "</span></td>";
      tbody.appendChild(tr);
    });
  }

  /* ——— طلب الشبكة ——— */
  async function loadReceivers() {
    const c = client();
    if (!c) return;
    const { data, error } = await c
      .from("wallet_receivers")
      .select("company, phone")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) return;

    receivers = { libyana: null, almadar: null };
    (data || []).forEach(function (row) {
      if (receivers[row.company] === null) receivers[row.company] = row.phone;
    });

    const form = document.getElementById("recharge-form");
    if (form) {
      const checked = form.querySelector('input[name="provider"]:checked');
      if (checked) renderProviderNumber(checked.value);
    }
  }

  async function loadBalance() {
    const c = client();
    const id = uid();
    if (!c || !id) return;
    const { data, error } = await c
      .from("wallets")
      .select("balance")
      .eq("user_id", id)
      .maybeSingle();
    if (error) return;
    renderBalance(data ? data.balance : 0);
  }

  async function loadHistory() {
    const c = client();
    if (!c || !uid()) return null;
    const { data, error } = await c
      .from("recharges")
      .select("id, company, sender_phone, amount, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return null;

    const rows = data || [];
    rows.forEach(function (r) {
      const prev = knownStatus[r.id];
      if (prev && prev !== r.status) {
        if (r.status === "success") {
          window.UI.toast("تم تأكيد التحويل وإضافة الرصيد إلى محفظتك.", {
            type: "success",
            title: "تم الشحن",
          });
        } else if (r.status === "failed") {
          window.UI.toast("لم يتم تأكيد التحويل. تحقّق من بيانات الإرسال.", {
            type: "danger",
            title: "فشل الطلب",
          });
        } else if (r.status === "needs_review") {
          window.UI.toast("طلبك قيد المراجعة اليدوية من فريق الدعم.", {
            type: "warning",
            title: "قيد المراجعة",
          });
        }
      }
      knownStatus[r.id] = r.status;
    });

    renderHistory(rows);
    return rows;
  }

  async function refresh() {
    await loadBalance();
    const rows = await loadHistory();
    updatePolling(rows);
  }

  /* ——— الاستعلام الدوري ——— */
  function hasPending(rows) {
    return (rows || []).some(function (r) {
      return r.status === "pending";
    });
  }

  function updatePolling(rows) {
    if (hasPending(rows)) {
      if (!pollTimer) {
        pollTimer = setInterval(function () {
          refresh();
        }, POLL_MS);
      }
    } else if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /* ——— النموذج ——— */
  function wireForm() {
    if (formWired) return;
    const form = document.getElementById("recharge-form");
    if (!form) return;
    formWired = true;

    const amount = document.getElementById("recharge-amount");
    const phone = document.getElementById("recharge-phone");

    H.attachLiveValidation(amount, [V.amount]);
    H.attachLiveValidation(phone, [V.lyPhone]);

    form.querySelectorAll('input[name="provider"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        renderProviderNumber(radio.value);
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submitRecharge(form);
    });

    renderProviderNumber(
      form.querySelector('input[name="provider"]:checked').value
    );
  }

  async function submitRecharge(form) {
    const c = client();
    if (!c) {
      window.UI.toast("تعذّر الاتصال بالخدمة. تأكّد من الاتصال بالإنترنت.", {
        type: "danger",
      });
      return;
    }
    if (!uid()) {
      window.UI.toast(ERROR_TEXT.not_authenticated, { type: "danger" });
      return;
    }

    const result = H.validateForm({
      "recharge-amount": [V.amount],
      "recharge-phone": [V.lyPhone],
    });
    if (!result.valid) {
      if (result.firstInvalid) result.firstInvalid.focus();
      window.UI.toast("يرجى تصحيح بيانات الشحن.", { type: "danger" });
      return;
    }

    const company = form.querySelector('input[name="provider"]:checked').value;
    const amountInput = document.getElementById("recharge-amount");
    const phoneInput = document.getElementById("recharge-phone");
    const btn = form.querySelector('button[type="submit"]');

    const original = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.classList.add("is-loading");
    }

    const { data, error } = await c.rpc("recharge_start", {
      p_company: company,
      p_sender_phone: phoneInput.value.trim(),
      p_amount: Number(amountInput.value),
    });

    if (btn) {
      btn.disabled = false;
      btn.classList.remove("is-loading");
      btn.textContent = original;
    }

    if (error) {
      window.UI.toast("تعذّر إرسال الطلب، حاول مرة أخرى.", { type: "danger" });
      return;
    }

    if (!data || data.ok !== true) {
      const code = data && data.error;
      window.UI.toast(ERROR_TEXT[code] || "تعذّر إنشاء طلب الشحن.", {
        type: "warning",
        title: "لم يتم إنشاء الطلب",
      });
      return;
    }

    window.UI.toast(
      "حوّل مبلغ " +
        formatCurrency(data.amount) +
        " د.ل إلى الرقم " +
        (data.receiver_phone || "") +
        " ثم سيُضاف الرصيد تلقائيًا بعد التحقق.",
      { type: "success", title: "تم إنشاء طلب الشحن", duration: 8000 }
    );

    amountInput.value = "";
    await refresh();
  }

  /* ——— نسخ رقم الاستقبال ——— */
  function wireCopy() {
    const btn = document.querySelector("[data-copy-number]");
    if (!btn) return;
    btn.addEventListener("click", function () {
      const valueEl = document.querySelector("[data-pay-value]");
      const text = valueEl ? valueEl.textContent.trim() : "";
      if (!text || text.indexOf("—") !== -1) return;

      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        window.UI.toast("المتصفح لا يدعم النسخ التلقائي.", { type: "warning" });
        return;
      }
      navigator.clipboard
        .writeText(text)
        .then(function () {
          window.UI.toast("تم نسخ الرقم.", { type: "success", duration: 2500 });
        })
        .catch(function () {
          window.UI.toast("تعذّر النسخ تلقائيًا.", { type: "warning" });
        });
    });
  }

  /* ——— الإقلاع ——— */
  function wireOnce() {
    wireForm();
    wireCopy();
  }

  function loadOnce() {
    if (dataLoaded) return;
    dataLoaded = true;
    loadReceivers();
    refresh();
  }

  function unavailable() {
    renderBalance(null);
    renderHistory([]);
    window.UI.toast(
      "تعذّر الاتصال بقاعدة البيانات. بعض البيانات قد لا تظهر الآن.",
      { type: "warning", title: "الاتصال غير متاح", duration: 6000 }
    );
  }

  document.addEventListener("supabase:ready", function () {
    wireOnce();
    loadOnce();
  });

  document.addEventListener("supabase:unavailable", function () {
    wireOnce();
    unavailable();
  });

  document.addEventListener("session:changed", function () {
    if (window.AppSession && window.AppSession.user) {
      loadReceivers();
      refresh();
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    wireOnce();
    if (window.SupabaseClientReady) loadOnce();
  });
})();
