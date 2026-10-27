# ليبيا GO — دليل الهيكلة والبناء

> اقرأ هذا الملف أولًا قبل أي تعديل. الغرض منه أن يفهم أي مبرمج أو مساعد ذكاء اصطناعي
> بنية المشروع، وترتيب التحميل، ومصادر الحقيقة، وما هو مسموح وما هو ممنوع تعديله.

---

## 1. نظرة عامة

**ليبيا GO** واجهة عربية (RTL) لبيع خدمات السوشيال ميديا، مبنية كموقع ثابت:

- **بدون إطار عمل** (No framework / No build step): HTML + CSS + JavaScript عادي.
- **الباك إند** مستضاف بالكامل على **Supabase**: Auth + Postgres + RLS + RPC + Edge Function.
- **العملة**: الدينار الليبي (د.ل).
- **مصدر الحقيقة للأموال** هو قاعدة البيانات فقط، وليس الواجهة.

أي منطق مالي أو صلاحيات يجب أن يبقى على الخادم (RPC أو RLS). الواجهة للعرض فقط.

---

## 2. التقنيات والمتطلبات

| العنصر | التفاصيل |
|---|---|
| الواجهة | HTML5, CSS3, JavaScript (ES5/ES2015 بدون تجميع) |
| الخطوط | Cairo + Tajawal من Google Fonts |
| Supabase JS | يُحمَّل كوحدة ES من `esm.sh` داخل `js/supabase-client.js` |
| المصادقة | Supabase Auth (بريد + كلمة مرور) |
| قاعدة البيانات | PostgreSQL 17 |
| Edge Function | Deno (`supabase/functions/sync-services`) |
| الأدوات | Supabase CLI (اختياري للتطوير)، أي خادم ملفات ثابت |

---

## 3. شجرة الملفات

```
/
├── index.html                 الصفحة الرئيسية: الرصيد + المنصات + الطلب
├── wallet.html                المحفظة: الرصيد، الشحن، سجل المعاملات
├── settings.html              إعدادات الحساب
├── login.html                 تسجيل الدخول
├── register.html              إنشاء حساب
├── assets/                    الشعار والأيقونات والصور
├── css/
│   ├── base.css               المتغيرات + السمة الداكنة/الفاتحة + إعادة الضبط
│   ├── layout.css             الهيدر، الفوتر، الحاويات، الشبكات
│   ├── components.css         الأزرار، البطاقات، الحقول، التنبيهات، الجداول
│   ├── pages.css              أنماط خاصة بالصفحات + بطاقات المنصات
│   └── sidebar.css            القائمة الجانبية (drawer) والطبقة الخلفية
├── js/
│   ├── config.js              رابط Supabase والمفتاح القابل للنشر
│   ├── supabase-client.js     إنشاء العميل + حدث supabase:ready
│   ├── auth-session.js        الجلسة، الدور، الحماية، التوجيه
│   ├── auth.js                تسجيل الدخول/الإنشاء/Google
│   ├── services.js            الرئيسية: المنصات، الخدمات، إنشاء الطلب
│   ├── platforms.js           مصنّف المنصات المشترك
│   ├── wallet.js              المحفظة والشحن وسجل المعاملات
│   ├── settings.js            صفحة الإعدادات
│   ├── main.js                القائمة الجانبية + السنة + سلوك عام
│   ├── ui.js                  التنبيهات (toast)، الحوارات
│   ├── icons.js               مكتبة أيقونات SVG داخلية
│   └── validation.js          تحقق حقول النماذج
├── admin/
│   ├── index.html             نظرة عامة
│   ├── users.html             المستخدمون والأرصدة
│   ├── providers.html         المزوّدون + المزامنة
│   ├── services.html          الخدمات + التصنيف + القواعد
│   ├── orders.html            الطلبات
│   ├── recharges.html         الاستلامات
│   ├── smsraed.html           ربط SMS RAEED
│   ├── settings.html          أرقام الاستقبال
│   ├── admin.js               كل منطق الإدارة
│   └── admin.css              تنسيق لوحة الإدارة
├── supabase/
│   ├── migrations/
│   │   ├── 20261027000000_service_platform.sql   تصنيف المنصات + القواعد
│   │   └── 20261028000000_provider_purge.sql     الحذف التام + لقطة الطلبات
│   └── functions/sync-services/index.ts          استيراد الخدمات من المزوّد
└── docs/
    ├── ARCHITECTURE.md        هذا الملف
    ├── DATABASE-AND-FLOWS.md  شرح قاعدة البيانات والتدفقات
    └── database-map.html      مخطط مرئي يُفتح في المتصفح
```

---

## 4. دورة حياة الصفحة

### 4.1 ترتيب تحميل السكربتات (مهم)

كل صفحة تحمّل السكربتات بهذا الترتيب، وكلها `defer`:

```
icons.js → ui.js → main.js → config.js → supabase-client.js
→ auth-session.js → [validation.js] → [سكربت الصفحة]
```

**لماذا هذا الترتيب؟**

1. `config.js` يعرّف `window.APP_CONFIG` قبل استخدامه.
2. `supabase-client.js` ينشئ `window.SupabaseClient` ثم يُطلق الحدث `supabase:ready`.
3. `auth-session.js` يستمع للحدث ويبدأ قراءة الجلسة.
4. سكربت الصفحة يستمع أيضًا لـ `supabase:ready` ويحمّل بياناته.

### 4.2 الأحداث المشتركة

| الحدث | من يُطلقه | من يستمع |
|---|---|---|
| `supabase:ready` | `supabase-client.js` | `auth-session.js`, `services.js`, `wallet.js` |
| `supabase:unavailable` | `supabase-client.js` (فشل التحميل) | كل صفحات البيانات |
| `session:changed` | `auth-session.js` بعد كل تغيير جلسة | `admin.js`, `services.js`, `wallet.js` |

### 4.3 قاعدة السباق (Race Condition)

لأن `supabase:ready` قد يُطلق **قبل** تسجيل المستمع (إذا كان العميل محمّلًا مسبقًا من الكاش)،
فكل سكربت بيانات يجب أن يتحقق عند `DOMContentLoaded`:

```js
document.addEventListener("DOMContentLoaded", function () {
  wireOnce();
  if (window.SupabaseClientReady) loadOnce(); // ← لا تنسَ هذا السطر
});
```

هذا موجود في `services.js` و`wallet.js`. أي صفحة جديدة يجب أن تتبعه.

---

## 5. الجلسة والأدوار والتوجيه

`js/auth-session.js` هو المسؤول الوحيد عن:

- `window.AppSession = { user, session, role, ready }`
- معرفة الدور من `profiles.role` (`user` أو `admin`)
- إظهار/إخفاء عناصر `[data-guest-only]` و`[data-auth-only]`
- إعادة التوجيه:

| الحالة | النتيجة |
|---|---|
| زائر في صفحة خاصة (`wallet`, `settings`, أو أي صفحة داخل `admin/`) | `login.html` |
| مشرف في صفحة عميل (`wallet`, `settings`, `login`, `register`) | `admin/index.html` |
| مستخدم عادي داخل `admin/` | `wallet.html` |
| مشرف داخل `admin/` | يبقى |

> حماية الواجهة **ليست** الحد الأمني. الحد الأمني الحقيقي هو RLS ودوال `SECURITY DEFINER`.

---

## 6. الواجهة العامة

### `index.html`

- هيدر مبسّط: زر القائمة الجانبية + الشعار.
- بطاقة الرصيد الحقيقي (`#home-balance`) وزر الشحن.
- شبكة المنصات (`#platforms-grid`) مبنية عبر `window.Platforms`.
- عند اختيار منصة: تُعرض خدماتها (`#services-by-platform`) ويُخفى الصف.
- نموذج الطلب `#order-form` يستدعي RPC `create_order` فقط.

**لا تُضف أسعارًا أو خصومات في الواجهة.** السعر النهائي يُحسب على الخادم.

### `wallet.html`

- الرصيد من `wallets`.
- الشحن عبر `recharge_start` → ينشئ صفًا في `recharges` بحالة `pending`.
- سجل المعاملات من `transactions`.

### `platforms.js`

مصنّف مشترك بين الواجهة والإدارة:

- `PLATFORMS`: كتالوج المنصات (مفتاح، اسم عربي، أيقونة).
- `KEYWORDS`: كلمات مفتاحية لكل منصة.
- `classify(service)`: يعيد مفتاح المنصة أو `other`.
- القاعدة: `category` أولًا ثم `name + description`، والتعارض ⇒ `other` (غير مصنف) بدل التخمين.

---

## 7. لوحة الإدارة

- كل صفحات `admin/*.html` تحتوي `<body data-page="...">`، و`admin.js` يختار الوحدة المناسبة من `MODULES`.
- `buildShell()` يبني القائمة الجانبية (drawer من اليمين) والشريط العلوي.
- `guard()` يتحقق من الجلسة والدور قبل تشغيل أي وحدة.
- التنقل موحّد عبر `NAV` في أعلى `admin.js`.

### صفحات الإدارة

| الصفحة | الوظيفة |
|---|---|
| `index.html` | إحصاءات سريعة وآخر الطلبات |
| `users.html` | المستخدمون + تعديل الرصيد عبر `admin_adjust_balance` |
| `providers.html` | إضافة/حفظ/حذف المزوّد + مزامنة الخدمات |
| `services.html` | تعديل الأسعار والهامش والتفعيل + تصنيف المنصات + قواعد التصنيف |
| `orders.html` | متابعة الطلبات وتغيير الحالة |
| `recharges.html` | اعتماد/رفض الاستلامات عبر `admin_recharge_action` |
| `smsraed.html` | حفظ واختبار مفتاح SMS RAEED عبر `admin_smsraed_*` |
| `settings.html` | إدارة أرقام الاستقبال `wallet_receivers` |

### الحذف التام للمزوّد (آخر تحديث)

- زر «حذف» في صفحة المزوّدين يجلب أولًا **عدد الخدمات والطلبات المتأثرة** ويعرضها في التأكيد.
- ثم يستدعي `delete_provider_cascade(p_provider_id)`.
- الدالة تحذف **كل خدمات المزوّد** ثم المزوّد، وتُبقي الطلبات والمعاملات.
- قبل الحذف تُحفظ لقطة `orders.service_name` حتى يبقى السجل مقروءًا.
- زر «تنظيف الخدمات غير المرتبطة» في صفحة الخدمات يستدعي `cleanup_orphan_services()`
  لحذف الخدمات التي `provider_id IS NULL` و`is_active = false` (يدويًا فقط).

---

## 8. الباك إند

### 8.1 الجداول

| الجدول | الغرض |
|---|---|
| `profiles` | ملف المستخدم ودوره وحالته |
| `wallets` | رصيد كل مستخدم |
| `transactions` | سجل مالي غير قابل للتعديل من الواجهة |
| `providers` | مزوّدو الخدمات ومفاتيح API |
| `services` | الخدمات المستوردة + السعر والهامش والتصنيف |
| `orders` | الطلبات + لقطة اسم الخدمة |
| `recharges` | طلبات شحن المحفظة |
| `wallet_receivers` | أرقام استقبال الأموال |
| `app_settings` | إعدادات عامة (مفاتيح/قيم) |
| `service_classification_rules` | قواعد تصنيف المنصات |

التفاصيل الكاملة والحقول في `docs/DATABASE-AND-FLOWS.md`.

### 8.2 الصلاحيات (RLS)

- `services`: القراءة للجميع للخدمات المفعّلة فقط، والإدارة للمشرف.
- `providers`, `orders`, `recharges`, `profiles`, `wallets`, `transactions`: مقيّدة بالمستخدم نفسه أو المشرف.
- `service_classification_rules`: المشرف فقط.
- الدوال الحساسة `SECURITY DEFINER` وتتحقق من `is_admin(auth.uid())` داخليًا.

### 8.3 دوال RPC

| الدالة | الغرض |
|---|---|
| `create_order(p_service, p_quantity, p_target)` | خصم الرصيد + إنشاء الطلب + معاملة |
| `recharge_start(p_company, p_sender_phone, p_amount)` | بدء طلب شحن |
| `credit_recharge(p_id)` | إضافة الرصيد مرة واحدة فقط (idempotent) |
| `admin_adjust_balance(p_user, p_amount)` | تعديل رصيد يدوي (مشرف) |
| `admin_recharge_action(p_id, p_action)` | اعتماد/مراجعة/رفض الاستلام |
| `admin_make_admin(p_email)` | ترقية مستخدم إلى مشرف |
| `admin_smsraed_*` | إدارة إعدادات SMS RAEED |
| `service_categories()` | قائمة تصنيفات المزوّدين |
| `reclassify_services(...)` | إعادة التصنيف التلقائي |
| `set_service_platform(...)` | تصنيف يدوي لخدمة |
| `bulk_set_service_platform(...)` | تصنيف يدوي جماعي |
| `delete_provider_cascade(p_provider_id)` | حذف المزوّد وخدماته نهائيًا |
| `cleanup_orphan_services()` | حذف الخدمات اليتيمة غير المفعّلة |

### 8.4 Edge Function: `sync-services`

- تتطلب JWT لمشرف.
- تقرأ المزوّدين النشطين من `providers`.
- تنادي API المزوّد: `POST {api_url}/api/v2` بـ `action=services`.
- تُدرج/تحدّث في `services` بمفتاح `(provider_id, provider_service_id)`.
- تصنّف المنصة تلقائيًا، ولا تغيّر التصنيف اليدوي (`platform_source = 'manual'`).

---

## 9. خطوات البناء من الصفر

### 9.1 المتطلبات

- حساب Supabase + مشروع.
- Supabase CLI (اختياري لكنه مفيد).
- خادم ملفات ثابت محلي (لا حاجة لـ Node إلا للتشغيل).

### 9.2 الإعداد المحلي

```powershell
git clone <repo-url>
cd "Libya saas"
```

1. عدّل `js/config.js`:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://<project-ref>.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_...",
};
```

2. شغّل خادمًا محليًا (لا تفتح الملفات بـ `file://` لأن وحدات ES وCORS قد تفشل):

```powershell
# أي خادم ثابت، مثال:
python -m http.server 4173
# أو
npx serve -l 4173
```

3. افتح `http://127.0.0.1:4173/index.html`.

### 9.3 قاعدة البيانات

> **مهم:** مخطط الجداول الأساسي (profiles/wallets/orders/...) غير موجود كملف SQL في
> المستودع؛ أُنشئ مباشرة على المشروع. الملفان الموجودان في `supabase/migrations`
> يضيفان ميزات فوق المخطط الأساسي.

الطريقة الآمنة على مشروع جديد:

```powershell
supabase link --project-ref <project-ref>
supabase db pull          # لسحب المخطط الأساسي إلى migrations (يتطلب Docker)
```

ثم طبّق ملفات هذا المستودع بالترتيب الزمني:

```powershell
supabase db query --linked -f supabase/migrations/20261027000000_service_platform.sql
supabase db query --linked -f supabase/migrations/20261028000000_provider_purge.sql
```

أو من **Supabase Dashboard → SQL Editor** بنفس الترتيب.

### 9.4 إنشاء أول مشرف

1. أنشئ حسابًا من `register.html`.
2. من SQL Editor:

```sql
select public.admin_make_admin('admin@example.com');
```

### 9.5 نشر Edge Function

```powershell
supabase functions deploy sync-services
```

---

## 10. النشر

الموقع ثابت، لذا يكفي أي استضافة ملفات:

- GitHub Pages (`.nojekyll` موجود).
- Netlify / Vercel / Cloudflare Pages.
- أي خادم ويب.

**لا ترفع** مفتاح `service_role` أو أي سر إلى المستودع. المفتاح الموجود في
`js/config.js` هو `publishable` مصمّم للظهور، والحماية عبر RLS.

---

## 11. قواعد تطوير إلزامية

1. **لا تحسب الأسعار في الواجهة.** اعرض فقط؛ الخادم هو من يخصم عبر `create_order`.
2. **لا تعدّل الرصيد مباشرة** من الواجهة؛ استخدم `admin_adjust_balance`.
3. **لا تحذف طلبات أو معاملات.** الحذف التام للمزوّد يحذف خدماته فقط.
4. **حافظ على ترتيب السكربتات** وقاعدة `SupabaseClientReady`.
5. **أي عمود جديد** يحتاج: migration + تعامل الواجهة مع غيابه (fallback) قبل تطبيقه.
6. **أي دالة إدارية** يجب أن تتحقق من `is_admin(auth.uid())` ولو كانت RLS تسمح.
7. **النصوص العربية**: استخدم `escapeHtml` عند إدراج بيانات من قاعدة البيانات.
8. **التصنيف اليدوي** (`platform_source = 'manual'`) لا يُلمس من المزامنة.

---

## 12. استكشاف الأخطاء الشائعة

| العَرَض | السبب المحتمل | الحل |
|---|---|---|
| «تعذّر تحميل الخدمات» | العمود `platform` غير موجود | طبّق migration التصنيف |
| «دالة الحذف غير مثبّتة» | `20261028000000` لم يُطبَّق | طبّقه من SQL Editor |
| الصفحة تعمل لكن لا بيانات | `supabase:ready` أُطلق قبل المستمع | تحقق من `SupabaseClientReady` في `DOMContentLoaded` |
| لا يظهر زر الإدارة | الدور ليس `admin` أو `is_active = false` | `admin_make_admin` + تحقق من `profiles` |
| المزامنة تفشل | `api_url` أو `api_key` خاطئ | اختبر من صفحة المزوّدين |
| الشحن لا يُضاف | `credit_recharge` لم يُستدعَ أو `credited = true` | راجع `admin_recharge_action` |

---

## 13. سجل التغييرات (مختصر)

| التاريخ | التغيير |
|---|---|
| 2026-10-27 | إعادة تصميم داكنة + قائمة جانبية + إزالة الأقسام التسويقية |
| 2026-10-27 | تصنيف الخدمات حسب المنصة + قواعد قابلة للتعديل |
| 2026-10-28 | حذف تام للمزوّد مع خدماته + لقطة اسم الخدمة في الطلبات + زر تنظيف اليتيمة |
| 2026-10-27 | إعادة تسمية المنصة إلى «ليبيا GO» + تحديث مفاتيح التخزين المحلي |
