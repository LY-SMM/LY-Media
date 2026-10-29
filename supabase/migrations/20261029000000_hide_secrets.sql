-- إخفاء الأسرار عن واجهة الإدارة:
-- 1) عمود محسوب يعلن فقط «هل المفتاح محفوظ؟» دون كشف القيمة.
-- 2) سحب صلاحية قراءة العمود api_key من anon/authenticated، فلا يصل المفتاح
--    إلى المتصفح أصلًا حتى لو طلب select=*. تبقى الكتابة متاحة للإدارة عبر RLS.
-- 3) إزالة key_hint (آخر 4 أحرف) من حالة ربط SMS RAEED.

alter table public.providers
  add column if not exists has_api_key boolean
  generated always as (api_key is not null and btrim(api_key) <> '') stored;

-- سحب قراءة الجدول ثم منح الأعمدة كلها عدا api_key.
revoke select on public.providers from anon, authenticated;

grant select (
  id, name, api_url, balance, is_active, sort_order,
  created_at, updated_at, dashboard_url, has_api_key
) on public.providers to anon, authenticated;

create or replace function public.admin_smsraed_status()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_enabled text;
  v_base text;
  v_key text;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select value into v_enabled from public.app_settings where key = 'smsraed_enabled';
  select value into v_base from public.app_settings where key = 'smsraed_base_url';
  if v_base is null then
    select decrypted_secret into v_base
      from vault.decrypted_secrets where name = 'smsraed_base_url' limit 1;
  end if;
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'smsraed_api_key' limit 1;

  return jsonb_build_object(
    'ok', true,
    'enabled', coalesce(v_enabled, 'false') = 'true',
    'base_url', coalesce(v_base, 'https://txguibjkbtroljtvbrlt.supabase.co/functions/v1/site_order'),
    'key_set', v_key is not null and length(btrim(v_key)) > 0
  );
end;
$function$;

notify pgrst, 'reload schema';
