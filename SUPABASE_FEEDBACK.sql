-- نفّذ هذا الملف مرة واحدة في SQL Editor لمشروع Supabase نفسه.
-- لا يمس جداول المنتجات والطلبات أو حساب المدير الحالي.
create table if not exists public.store_likes (
  visitor_id uuid primary key,
  created_at timestamptz not null default now()
);
create table if not exists public.customer_suggestions (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  message text not null,
  created_at timestamptz not null default now(),
  constraint suggestion_name_length check (customer_name is null or char_length(customer_name) between 1 and 80),
  constraint suggestion_message_length check (char_length(trim(message)) between 5 and 1500)
);
alter table public.store_likes enable row level security;
alter table public.customer_suggestions enable row level security;
-- لا تسمح بالوصول المباشر لجدول الإعجابات من متصفح الزبون.
revoke all on public.store_likes from anon, authenticated;
revoke all on public.customer_suggestions from anon, authenticated;
-- الزبائن يمكنهم إرسال الاقتراحات فقط، ولا يمكنهم قراءة اقتراحات الآخرين.
create policy "joker_public_submit_suggestion" on public.customer_suggestions for insert to anon, authenticated with check (true);
grant insert (customer_name,message) on public.customer_suggestions to anon, authenticated;
-- المدير المسجل في admin_users وحده يمكنه قراءة الاقتراحات.
create policy "joker_admin_read_suggestions" on public.customer_suggestions for select to authenticated using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
grant select on public.customer_suggestions to authenticated;
-- دوال محدودة الصلاحيات لقراءة العدد وتبديل إعجاب هذا المتصفح.
create or replace function public.joker_like_status(p_visitor uuid)
returns table(total_likes bigint, is_liked boolean) language sql security definer set search_path = '' as $$
  select (select count(*) from public.store_likes), exists(select 1 from public.store_likes where visitor_id=p_visitor);
$$;
create or replace function public.joker_toggle_like(p_visitor uuid)
returns table(total_likes bigint, is_liked boolean) language plpgsql security definer set search_path = '' as $$
declare current_like boolean;
begin
  -- قفل لكل معرّف لمنع الضغط المتزامن من تكرار التبديل.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_visitor::text));
  select exists(select 1 from public.store_likes where visitor_id=p_visitor) into current_like;
  if current_like then
    delete from public.store_likes where visitor_id=p_visitor;
  else
    insert into public.store_likes(visitor_id) values(p_visitor);
  end if;
  return query select (select count(*) from public.store_likes), not current_like;
end;$$;
revoke all on function public.joker_like_status(uuid) from public;
revoke all on function public.joker_toggle_like(uuid) from public;
grant execute on function public.joker_like_status(uuid), public.joker_toggle_like(uuid) to anon, authenticated;
