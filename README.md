# ليبيا GO — Libya GO

واجهة عربية لبيع خدمات السوشيال ميديا، مبنية بـ HTML/CSS/JS بدون إطار عمل،
مع Supabase كباك إند (Auth + Postgres + RLS + RPC + Edge Function).

## التشغيل السريع

```powershell
# 1) عدّل بيانات الاتصال
#    js/config.js → SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY

# 2) شغّل خادمًا محليًا ثابتًا
python -m http.server 4173
# ثم افتح http://127.0.0.1:4173/index.html
```

## التوثيق

| الملف | المحتوى |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | هيكلة المشروع، ترتيب السكربتات، خطوات البناء والنشر |
| [`docs/DATABASE-AND-FLOWS.md`](docs/DATABASE-AND-FLOWS.md) | شرح الجداول والتدفقات (تسجيل، طلبات، شحن، تصنيف، حذف) |
| [`docs/database-map.html`](docs/database-map.html) | مخطط مرئي يُفتح في المتصفح |

## البنية

```
index.html / wallet.html / settings.html / login.html / register.html
css/        الأنماط والسمة الداكنة والقائمة الجانبية
js/         العميل، الجلسة، الخدمات، المحفظة، الأيقونات
admin/      لوحة الإدارة (صفحة لكل قسم + admin.js)
supabase/   migrations + edge function (sync-services)
docs/       التوثيق
```

## قواعد أساسية

- الأسعار والخصم تُحسب على الخادم فقط (`create_order`).
- الرصيد لا يُعدّل من الواجهة؛ عبر `admin_adjust_balance` أو `credit_recharge`.
- الطلبات والمعاملات لا تُحذف عند حذف مزوّد أو خدمة.
- كل دالة إدارية تتحقق من `is_admin(auth.uid())`.

## قاعدة البيانات

طبّق ملفات `supabase/migrations` بالترتيب الزمني (أو من Supabase SQL Editor):

1. `20261027000000_service_platform.sql`
2. `20261028000000_provider_purge.sql`

مخطط الجداول الأساسي مُدار على مشروع Supabase نفسه (انظر `docs/DATABASE-AND-FLOWS.md`).
