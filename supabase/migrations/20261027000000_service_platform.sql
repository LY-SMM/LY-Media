/*
  20261027000000_service_platform.sql
  ------------------------------------------------------------------
  - يضيف تصنيف المنصة المحلي للخدمات (platform / platform_source).
  - يضيف جدول قواعد التصنيف القابلة للتعديل.
  - يضيف دوال التصنيف وإعادة التصنيف وتغيير التصنيف يدويًا.

  ملاحظة: دالة حذف المزوّد انتقلت إلى
  20261028000000_provider_purge.sql (حذف تام مع حفظ لقطة اسم الخدمة).

  آمن لإعادة التنفيذ (idempotent) قدر الإمكان.
  نفّذه من Supabase SQL Editor قبل استخدام واجهة التصنيف الجديدة.
*/

-- ==================================================================
-- 1) أعمدة التصنيف المحلي على جدول الخدمات
-- ==================================================================
alter table public.services add column if not exists platform text;
alter table public.services add column if not exists platform_source text not null default 'auto';
alter table public.services add column if not exists platform_locked boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'services_platform_source_check'
  ) then
    alter table public.services
      add constraint services_platform_source_check
      check (platform_source in ('auto', 'manual'));
  end if;
end $$;

create index if not exists services_platform_idx on public.services (platform);

-- ضروري لفصل الخدمات المرتبطة بطلبات عند حذف المزوّد بدل حذفها.
alter table public.services alter column provider_id drop not null;

-- ==================================================================
-- 2) جدول قواعد التصنيف
-- ==================================================================
create table if not exists public.service_classification_rules (
  id bigserial primary key,
  platform text not null,
  keyword text not null,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists service_classification_rules_uniq
  on public.service_classification_rules (platform, lower(keyword));

-- قواعد ابتدائية. التعديل لاحقًا من لوحة الإدارة.
insert into public.service_classification_rules (platform, keyword, priority) values
  ('instagram', 'instagram', 10),
  ('instagram', 'insta', 20),
  ('instagram', 'انستقرام', 10),
  ('instagram', 'انستغرام', 10),
  ('instagram', 'ريلز', 40),
  ('instagram', 'reels', 40),
  ('instagram', 'ستوري', 50),
  ('instagram', 'stories', 50),
  ('tiktok', 'tiktok', 10),
  ('tiktok', 'tik tok', 10),
  ('tiktok', 'تيك توك', 10),
  ('tiktok', 'تيكتوك', 10),
  ('youtube', 'youtube', 10),
  ('youtube', 'you tube', 10),
  ('youtube', 'يوتيوب', 10),
  ('youtube', 'ساعات مشاهدة', 40),
  ('youtube', 'watch time', 40),
  ('facebook', 'facebook', 10),
  ('facebook', 'فيسبوك', 10),
  ('facebook', 'فيس بوك', 10),
  ('twitter', 'twitter', 10),
  ('twitter', 'تويتر', 10),
  ('twitter', 'x.com', 20),
  ('telegram', 'telegram', 10),
  ('telegram', 'تيليجرام', 10),
  ('telegram', 'تليجرام', 10),
  ('whatsapp', 'whatsapp', 10),
  ('whatsapp', 'واتساب', 10),
  ('snapchat', 'snapchat', 10),
  ('snapchat', 'سناب', 10),
  ('spotify', 'spotify', 10),
  ('spotify', 'سبوتيفاي', 10),
  ('discord', 'discord', 10),
  ('discord', 'ديسكورد', 10),
  ('linkedin', 'linkedin', 10),
  ('linkedin', 'لينكدإن', 10),
  ('pinterest', 'pinterest', 10),
  ('pinterest', 'بنترست', 10)
on conflict do nothing;

alter table public.service_classification_rules enable row level security;

drop policy if exists "classification rules admin only" on public.service_classification_rules;
create policy "classification rules admin only"
  on public.service_classification_rules
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ==================================================================
-- 3) دوال التصنيف
-- ==================================================================
-- تطبيع النص: حروف صغيرة + إزالة التشكيل + توحيد الألف/الياء/التاء المربوطة.
create or replace function public.normalize_text(p_text text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        translate(
          lower(coalesce(p_text, '')),
          'أإآٱىةؤئًٌٍَُِّْٰ',
          'ااااييهء'
        ),
        '\s+', ' ', 'g'
      ),
      '[[:cntrl:]]', '', 'g'
    )
  );
$$;

-- يحدد منصة واحدة من نص. الأولوية الأقل تفصل التعارض،
-- وعند تعادل الأولوية بين منصتين نعيد null (غموض) بدل التخمين.
create or replace function public.detect_platform(p_text text)
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_hay text;
  v_best text := null;
  v_best_priority integer := null;
  v_ambiguous boolean := false;
  r record;
begin
  v_hay := public.normalize_text(p_text);
  if v_hay = '' then
    return null;
  end if;

  for r in
    select lower(platform) as platform, keyword, priority
    from public.service_classification_rules
    where is_active and btrim(keyword) <> ''
    order by priority asc, length(keyword) desc
  loop
    if position(public.normalize_text(r.keyword) in v_hay) > 0 then
      if v_best is null or r.priority < v_best_priority then
        v_best := r.platform;
        v_best_priority := r.priority;
        v_ambiguous := false;
      elsif r.priority = v_best_priority and v_best <> r.platform then
        v_ambiguous := true;
      end if;
    end if;
  end loop;

  if v_ambiguous then
    return null;
  end if;
  return v_best;
end;
$$;

-- يصنّف خدمة: الفئة أولًا، ثم الاسم والوصف، والتعارض ⇒ غير مصنف.
create or replace function public.classify_platform(
  p_name text,
  p_description text,
  p_category text
)
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_cat text;
  v_name text;
begin
  v_cat := public.detect_platform(p_category);
  v_name := public.detect_platform(
    coalesce(p_name, '') || ' ' || coalesce(p_description, '')
  );

  if v_cat is not null and v_name is not null then
    return case when v_cat = v_name then v_cat else 'other' end;
  end if;
  if v_cat is not null then
    return v_cat;
  end if;
  if v_name is not null then
    return v_name;
  end if;
  return 'other';
end;
$$;

-- ==================================================================
-- 4) دوال الإدارة (تتحقق من دور admin على الخادم)
-- ==================================================================
create or replace function public.reclassify_services(
  p_provider_id bigint default null,
  p_only_unclassified boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.services s
     set platform = public.classify_platform(s.name, s.description, s.category),
         platform_source = 'auto'
   where coalesce(s.platform_source, 'auto') <> 'manual'
     and coalesce(s.platform_locked, false) = false
     and (p_provider_id is null or s.provider_id = p_provider_id)
     and (
       p_only_unclassified = false
       or s.platform is null
       or s.platform = ''
       or s.platform = 'other'
     );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.set_service_platform(
  p_service_id bigint,
  p_platform text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_platform text;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_platform := lower(btrim(coalesce(p_platform, 'other')));
  if length(v_platform) = 0 or length(v_platform) > 50 then
    return jsonb_build_object('ok', false, 'error', 'invalid_platform');
  end if;

  update public.services
     set platform = v_platform,
         platform_source = 'manual',
         platform_locked = true
   where id = p_service_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'service_not_found');
  end if;

  return jsonb_build_object('ok', true, 'platform', v_platform);
end;
$$;

create or replace function public.bulk_set_service_platform(
  p_service_ids bigint[],
  p_platform text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_platform text;
  v_count integer := 0;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    return jsonb_build_object('ok', false, 'error', 'empty_selection');
  end if;

  v_platform := lower(btrim(coalesce(p_platform, '')));
  if length(v_platform) = 0 or length(v_platform) > 50 then
    return jsonb_build_object('ok', false, 'error', 'invalid_platform');
  end if;

  update public.services
     set platform = v_platform,
         platform_source = 'manual',
         platform_locked = true
   where id = any(p_service_ids);

  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'updated', v_count, 'platform', v_platform);
end;
$$;

-- ملاحظة:
-- دالة delete_provider_cascade نُقلت إلى الملف
-- 20261028000000_provider_purge.sql لأن سلوكها صار "حذفًا تامًا"
-- (حذف خدمات المزوّد معه مع حفظ لقطة اسم الخدمة في الطلبات).
-- لا تُعرَّف هنا حتى لا يعيد ترتيبُ تطبيق الملفين السلوك القديم.

-- ==================================================================
-- 5) الصلاحيات: للمسؤولين المسجّلين فقط
-- ==================================================================
revoke all on function public.reclassify_services(bigint, boolean) from public;
revoke all on function public.set_service_platform(bigint, text) from public;
revoke all on function public.bulk_set_service_platform(bigint[], text) from public;

grant execute on function public.reclassify_services(bigint, boolean) to authenticated;
grant execute on function public.set_service_platform(bigint, text) to authenticated;
grant execute on function public.bulk_set_service_platform(bigint[], text) to authenticated;

-- التصنيف الأولي للخدمات الموجودة (يحترم التصنيف اليدوي إن وُجد).
update public.services s
   set platform = public.classify_platform(s.name, s.description, s.category)
 where coalesce(s.platform_source, 'auto') <> 'manual'
   and coalesce(s.platform_locked, false) = false
   and (s.platform is null or s.platform = '');
