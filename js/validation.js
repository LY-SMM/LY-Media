/*
  validation.js
  أدوات التحقق من صحة المدخلات، مشتركة بين نماذج الدخول والتسجيل والمحفظة.
  لا تجري أي اتصال بالشبكة؛ التحقق هنا شكلي بالكامل.
*/

(function () {
  "use strict";

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  // أرقام ليبية: تبدأ بـ 09 وتتكوّن من 10 أرقام
  const LY_PHONE_RE = /^09[0-9]{8}$/;

  const Validators = {
    required: function (value) {
      return value.trim().length > 0 || "هذا الحقل مطلوب.";
    },
    email: function (value) {
      if (!value.trim()) return "البريد الإلكتروني مطلوب.";
      return EMAIL_RE.test(value.trim()) || "صيغة البريد الإلكتروني غير صحيحة.";
    },
    password: function (value) {
      if (!value) return "كلمة المرور مطلوبة.";
      if (value.length < 8) return "يجب ألا تقل كلمة المرور عن 8 أحرف.";
      if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value))
        return "يجب أن تجمع كلمة المرور بين أحرف وأرقام.";
      return true;
    },
    lyPhone: function (value) {
      if (!value.trim()) return "رقم الهاتف مطلوب.";
      if (!LY_PHONE_RE.test(value.trim()))
        return "أدخل رقمًا ليبيًا صحيحًا يبدأ بـ 09 ويتكوّن من 10 أرقام.";
      return true;
    },
    amount: function (value) {
      const n = Number(value);
      if (!value || Number.isNaN(n)) return "أدخل مبلغًا صحيحًا.";
      if (n < 1) return "أقل مبلغ للشحن هو 1 د.ل.";
      if (n > 1000) return "أقصى مبلغ للشحن هو 1000 د.ل.";
      return true;
    },
    match: function (value, other) {
      return value === other || "كلمتا المرور غير متطابقتين.";
    },
  };

  /* ——— أدوات مساعدة للتعامل مع الحقول ——— */
  function setFieldError(input, message) {
    const field = input.closest(".field");
    if (!field) return;
    const errorEl = field.querySelector(".field__error");
    const isError = Boolean(message);
    input.setAttribute("aria-invalid", String(isError));
    if (errorEl) errorEl.textContent = isError ? message : "";
  }

  function clearFieldError(input) {
    setFieldError(input, "");
  }

  /**
   * يتحقّق من حقل واحد عبر قواعد محدّدة.
   * rules: مصفوفة دوال تعيد true أو رسالة خطأ.
   */
  function validateField(input, rules) {
    const value = input.value;
    for (let i = 0; i < rules.length; i++) {
      const result = rules[i](value);
      if (result !== true) {
        setFieldError(input, result);
        return false;
      }
    }
    clearFieldError(input);
    return true;
  }

  /**
   * يتحقّق من نموذج كامل عبر خريطة: { inputId: [rules...] }
   * يعيد كائن { valid, firstInvalid }
   */
  function validateForm(map) {
    let valid = true;
    let firstInvalid = null;
    Object.keys(map).forEach(function (id) {
      const input = document.getElementById(id);
      if (!input) return;
      const ok = validateField(input, map[id]);
      if (!ok && !firstInvalid) firstInvalid = input;
      valid = valid && ok;
    });
    return { valid: valid, firstInvalid: firstInvalid };
  }

  /* ——— تحقّق فوري عند الكتابة/الخروج من الحقل ——— */
  function attachLiveValidation(input, rules) {
    input.addEventListener("blur", function () {
      validateField(input, rules);
    });
    input.addEventListener("input", function () {
      if (input.getAttribute("aria-invalid") === "true") {
        validateField(input, rules);
      }
    });
  }

  window.Validators = Validators;
  window.FormHelpers = {
    setFieldError,
    clearFieldError,
    validateField,
    validateForm,
    attachLiveValidation,
  };
})();
