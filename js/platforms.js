/*
  platforms.js
  تصنيف الخدمات المحلية حسب المنصة (Instagram / TikTok / ...).

  التصنيف المحلي مستقل تمامًا عن هوية الخدمة لدى المزوّد:
  - provider_id + provider_service_id يظلان المرجع لتنفيذ الطلبات.
  - platform هو تصنيف محلي فقط يُستخدم لتنظيم العرض والفلترة.

  أولوية التصنيف:
  1) تصنيف يدوي مثبّت (platform_locked / platform_source = manual) — لا يُلمس.
  2) فئة المزوّد الأصلية (category) إن كانت تحدد منصة معروفة.
  3) اسم الخدمة + وصفها.
  4) غير مصنف (other) بدلًا من إسناد منصة خاطئة.
*/

(function () {
  "use strict";

  const PLATFORMS = {
    instagram: { label: "إنستغرام", icon: "instagram" },
    tiktok: { label: "تيك توك", icon: "tiktok" },
    youtube: { label: "يوتيوب", icon: "youtube" },
    facebook: { label: "فيسبوك", icon: "facebook" },
    twitter: { label: "تويتر / X", icon: "twitter" },
    telegram: { label: "تيليجرام", icon: "telegram" },
    whatsapp: { label: "واتساب", icon: "whatsapp" },
    snapchat: { label: "سناب شات", icon: "snapchat" },
    spotify: { label: "سبوتيفاي", icon: "spotify" },
    discord: { label: "ديسكورد", icon: "discord" },
    linkedin: { label: "لينكدإن", icon: "linkedin" },
    pinterest: { label: "بنترست", icon: "pinterest" },
    other: { label: "غير مصنف", icon: "grid" },
  };

  // كلمات مفتاحية لكل منصة. تُطبّع النصوص أولًا (حروف صغيرة، إزالة التشكيل،
  // توحيد الألف والياء والتاء المربوطة) ثم تُقارن.
  const KEYWORDS = {
    instagram: [
      "instagram", "insta", "ig ", " ig", "ig/", "انستقرام", "انستغرام", "إنستغرام",
      "انستجرام", "إنستجرام", "انستا", "ستوري", "ستوريز", "story", "stories",
      "reel", "reels", "ريلز", "ريلس",
    ],
    tiktok: [
      "tiktok", "tik tok", "tik-tok", "tt ", " tt", "تيك توك", "تيكتوك", "تكتوك",
      "تيك توك", "مشاهدات تيك", "douyin",
    ],
    youtube: [
      "youtube", "yt ", " yt", "يوتيوب", "يوتوب", "مشتركين يوتيوب", "watch time",
      "ساعات مشاهدة", "short", "shorts", "شورت",
    ],
    facebook: [
      "facebook", "fb ", " fb", "فيسبوك", "فيس بوك", "فيس", "فيسبوك", "صفحة فيسبوك",
      "page like", "likes page",
    ],
    twitter: ["twitter", "تويتر", "x.com", "retweet", "ريتويت", " tweet", "ترند"],
    telegram: ["telegram", "تيليجرام", "تليجرام", "تلجرام", "tg ", "members telegram"],
    whatsapp: ["whatsapp", "واتساب", "واتس اب", "whats app"],
    snapchat: ["snapchat", "سناب", "snap "],
    spotify: ["spotify", "سبوتيفاي", "سبوتفاي"],
    discord: ["discord", "ديسكورد", "دسكورد"],
    linkedin: ["linkedin", "لينكدإن", "لينكدان"],
    pinterest: ["pinterest", "بنترست", "بينترست"],
  };

  // كلمات عامة لا تحدد منصة — تُستخدم لتفادي التخمين الخاطئ.
  const AMBIGUOUS = ["followers", "likes", "views", "comments", "shares", "اشترك", "متابعين", "لايكات", "مشاهدات"];

  function normalize(value) {
    let s = String(value == null ? "" : value).toLowerCase().trim();
    try {
      s = s.normalize("NFKD").replace(/[\u064B-\u065F\u0670]/g, "");
    } catch (e) {
      /* تجاهل */
    }
    s = s
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[ؤئ]/g, "ء")
      .replace(/[\u200E\u200F\u061C]/g, "")
      .replace(/\s+/g, " ");
    return s;
  }

  function matchInText(text, keywords) {
    const haystack = normalize(text);
    for (let i = 0; i < keywords.length; i++) {
      if (haystack.indexOf(normalize(keywords[i])) !== -1) return true;
    }
    return false;
  }

  /**
   * يحدد المنصة من نص واحد. يعيد مفتاح المنصة أو null.
   * إن تطابقت أكثر من منصة بنفس النص نعيد null (غموض) بدل التخمين.
   */
  function detectFromText(text) {
    const matches = [];
    Object.keys(KEYWORDS).forEach(function (key) {
      if (matchInText(text, KEYWORDS[key])) matches.push(key);
    });
    if (matches.length === 1) return matches[0];
    return null;
  }

  /**
   * التصنيف الكامل لخدمة. service: { category, name, description, platform,
   * platform_source, platform_locked, provider_category }
   */
  function classify(service) {
    const s = service || {};

    // 1) تصنيف يدوي — لا يُلمس
    const source = String(s.platform_source || "").toLowerCase();
    if ((source === "manual" || s.platform_locked) && s.platform) {
      return String(s.platform).toLowerCase();
    }

    // 2) فئة المزوّد
    const category = s.provider_category || s.category;
    const byCategory = detectFromText(category);

    // 3) الاسم والوصف
    const byName = detectFromText(String(s.name || "") + " " + String(s.description || ""));

    // إن اتفقت الفئة والاسم على منصة واحدة فهي الأقوى.
    if (byCategory && byName && byCategory === byName) return byCategory;
    if (byCategory && !byName) return byCategory;
    if (byName && !byCategory) return byName;

    // تعارض أو لا شيء ⇒ غير مصنف بدل التخمين.
    return "other";
  }

  function label(platform) {
    const meta = PLATFORMS[String(platform || "other").toLowerCase()];
    return meta ? meta.label : String(platform || "غير مصنف");
  }

  function icon(platform) {
    const key = String(platform || "other").toLowerCase();
    const meta = PLATFORMS[key];
    return meta ? meta.icon : "grid";
  }

  function isUnclassified(service) {
    const p = String((service && service.platform) || "").toLowerCase();
    return !p || p === "other" || p === "uncategorized";
  }

  window.Platforms = {
    PLATFORMS: PLATFORMS,
    KEYWORDS: KEYWORDS,
    AMBIGUOUS: AMBIGUOUS,
    normalize: normalize,
    detectFromText: detectFromText,
    classify: classify,
    label: label,
    icon: icon,
    isUnclassified: isUnclassified,
  };
})();
