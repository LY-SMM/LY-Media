/*
  config.js
  إعدادات الاتصال بالخدمة الخلفية.

  هذه القيم مخصّصة للمتصفح فقط:
  - المفتاح العام (sb_publishable_...) مفتاح "قابل للنشر" صمّمه المزوّد ليكون
    ظاهرًا في المتصفح، وحمايته تتم عبر سياسات RLS في قاعدة البيانات، لا عبر
    إخفائه في الكود.
  - مفتاح sbp_ السري (secret) لا يوضع هنا ولا في أي ملف واجهة أمامية إطلاقًا.
*/

window.APP_CONFIG = {
  SUPABASE_URL: "https://gzcdvfcuzjhtyfpfsfka.supabase.co",
  SUPABASE_PUBLISHABLE_KEY:
    "sb_publishable_O48X1_DSvYSHBh9IeHxoHQ_RHzbEAxM",
};
