/*
  20261028000000_provider_purge.sql
  ------------------------------------------------------------------
  الحذف التام للمزوّد:
    - عند حذف مزوّد تُحذف كل خدماته نهائيًا معه.
    - الطلبات والمعاملات لا تُحذف أبدًا.
    - تُحفظ لقطة اسم الخدمة داخل الطلب (orders.service_name) حتى
      يبقى سجل الطلبات مقروءًا بعد اختفاء الخدمة.

  أيضًا:
    - create_order يمنع طلب خدمة بلا مزوّد (provider_id is null).
    - cleanup_orphan_services() لتنظيف الخدمات اليتيمة غير المفعّلة
      يدويًا من لوحة الإدارة (لا تُنفّذ تلقائيًا).

  آمن لإعادة التنفيذ (idempotent).
*/

-- ==================================================================
-- 1) لقطة اسم الخدمة داخل الطلبات
-- ==================================================================
alter table public.orders add column if not exists service_name text;

-- تعبئة رجعية للطلبات الموجودة التي ما زالت مرتبطة بخدمة.
update public.orders o
   set service_name = s.name
  from public.services s
 where o.service_id = s.id
   and o.service_name is null;

-- ==================================================================
-- 2) create_order: منع الخدمات بلا مزوّد + حفظ اسم الخدمة
--    (لا تغيير في الرصيد أو الخصم أو سجل المعاملات)
-- ==================================================================
create or replace function public.create_order(
  p_service bigint,
  p_quantity integer,
  p_target text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_svc public.services%rowtype;
  v_before numeric;
  v_after numeric;
  v_charge numeric;
  v_order_id bigint;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if p_quantity is null or p_quantity <= 0 then return jsonb_build_object('ok', false, 'error', 'invalid_quantity'); end if;
  if p_target is null or btrim(p_target) = '' then return jsonb_build_object('ok', false, 'error', 'empty_target'); end if;

  select * into v_svc
    from public.services
   where id = p_service
     and is_active
     and provider_id is not null;

  if not found then return jsonb_build_object('ok', false, 'error', 'service_not_found'); end if;
  if p_quantity < v_svc.min_qty or (v_svc.max_qty is not null and p_quantity > v_svc.max_qty) then
    return jsonb_build_object('ok', false, 'error', 'quantity_out_of_range');
  end if;

  v_charge := round(v_svc.rate * p_quantity, 2);

  insert into public.wallets (user_id, balance) values (v_uid, 0) on conflict (user_id) do nothing;
  select balance into v_before from public.wallets where user_id = v_uid for update;
  if v_before < v_charge then
    return jsonb_build_object('ok', false, 'error', 'insufficient_funds', 'required', v_charge, 'balance', v_before);
  end if;
  v_after := v_before - v_charge;

  update public.wallets set balance = v_after, updated_at = now() where user_id = v_uid;
  insert into public.orders (user_id, service_id, service_name, quantity, charge, target)
    values (v_uid, v_svc.id, v_svc.name, p_quantity, v_charge, btrim(p_target))
    returning id into v_order_id;
  insert into public.transactions (user_id, type, amount, description)
    values (v_uid, 'order', -v_charge, 'طلب خدمة');

  return jsonb_build_object('ok', true, 'order_id', v_order_id, 'charge', v_charge, 'balance', v_after);
end;
$$;

-- ==================================================================
-- 3) حذف المزوّد نهائيًا مع خدماته
-- ==================================================================
create or replace function public.delete_provider_cascade(p_provider_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_services integer := 0;
  v_orders integer := 0;
begin
  if p_provider_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_provider');
  end if;

  if not public.is_admin(auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select name into v_name from public.providers where id = p_provider_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'provider_not_found');
  end if;

  -- لقطة أسماء الخدمات في الطلبات قبل الحذف.
  update public.orders o
     set service_name = coalesce(o.service_name, s.name)
    from public.services s
   where s.provider_id = p_provider_id
     and o.service_id = s.id;
  get diagnostics v_orders = row_count;

  select count(*) into v_services
    from public.services
   where provider_id = p_provider_id;

  -- حذف كل خدمات المزوّد ثم المزوّد نفسه.
  -- قيد orders.service_id هو ON DELETE SET NULL، فلا تُحذف الطلبات.
  delete from public.services where provider_id = p_provider_id;
  delete from public.providers where id = p_provider_id;

  return jsonb_build_object(
    'ok', true,
    'provider_name', v_name,
    'services_deleted', v_services,
    'orders_detached', v_orders
  );
end;
$$;

-- ==================================================================
-- 4) تنظيف الخدمات اليتيمة غير المفعّلة (يدويًا من لوحة الإدارة)
-- ==================================================================
create or replace function public.cleanup_orphan_services()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_orders integer := 0;
  v_deleted integer := 0;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.orders o
     set service_name = coalesce(o.service_name, s.name)
    from public.services s
   where s.provider_id is null
     and s.is_active = false
     and o.service_id = s.id;
  get diagnostics v_orders = row_count;

  delete from public.services
   where provider_id is null
     and is_active = false;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'services_deleted', v_deleted,
    'orders_detached', v_orders
  );
end;
$$;

-- ==================================================================
-- 5) الصلاحيات: للمشرفين المسجّلين فقط
-- ==================================================================
revoke all on function public.delete_provider_cascade(bigint) from public;
revoke all on function public.cleanup_orphan_services() from public;

do $$
begin
  begin
    revoke all on function public.delete_provider_cascade(bigint) from anon;
  exception when undefined_object then null;
  end;
  begin
    revoke all on function public.cleanup_orphan_services() from anon;
  exception when undefined_object then null;
  end;
end $$;

grant execute on function public.delete_provider_cascade(bigint) to authenticated;
grant execute on function public.cleanup_orphan_services() to authenticated;
