-- Handpan Theory login sync: schema, RPCs, privileges. Plan: docs/plans/2026-11-05-login-sync-v2.md
-- Run in the Supabase SQL editor of a project (owner gate O5). Safe to re-run.
-- Writes happen only through push_scales and delete_my_account (security definer).

create table if not exists public.saved_scales (
  user_id    uuid        not null references auth.users on delete cascade,
  scale_id   uuid        not null,
  rev        bigint      not null,
  record     jsonb,
  deleted    boolean     not null default false,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, scale_id),
  constraint saved_scales_record_size check (record is null or octet_length(record::text) <= 8192)
);
create unique index if not exists saved_scales_user_rev on public.saved_scales (user_id, rev);

create table if not exists public.sync_users (
  user_id  uuid   primary key references auth.users on delete cascade,
  last_rev bigint not null default 0
);

create table if not exists public.scale_history (
  id          bigserial   primary key,
  user_id     uuid        not null references auth.users on delete cascade,
  scale_id    uuid        not null,
  record      jsonb       not null,
  replaced_at timestamptz not null default now()
);
create index if not exists scale_history_user on public.scale_history (user_id, scale_id, replaced_at);
create index if not exists scale_history_replaced on public.scale_history (replaced_at);

alter table public.saved_scales  enable row level security;
alter table public.sync_users    enable row level security;
alter table public.scale_history enable row level security;

revoke all on table public.saved_scales, public.sync_users, public.scale_history from public, anon, authenticated;
revoke all on sequence public.scale_history_id_seq from public, anon, authenticated;
grant select on table public.saved_scales, public.sync_users to authenticated;

drop policy if exists saved_scales_select_own on public.saved_scales;
create policy saved_scales_select_own on public.saved_scales
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists sync_users_select_own on public.sync_users;
create policy sync_users_select_own on public.sync_users
  for select to authenticated using (user_id = (select auth.uid()));

-- Dedicated purge role. Owner sets a password only if the runner is the GitHub Actions workflow (O8):
--   alter role sync_purger with login password '<secret>';
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'sync_purger') then
    create role sync_purger nologin;
  end if;
end
$$;
grant usage on schema public to sync_purger;

-- push_scales(rows): rows = [{scale_id, base_rev, record|null, deleted}], at most 200.
-- Per row returns {scale_id, rev} | {scale_id, conflict:true} | {scale_id, refused:'cap'|'unknown'|'rate'|'size'|'invalid'}.
-- Refused and conflicting rows consume no rev, so accepted revs are gap-free and commit in order.
create or replace function public.push_scales(rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_rev   bigint;
  v_live  integer;
  v_total integer;
  v_hist  integer;
  v_out   jsonb := '[]'::jsonb;
  v_item  jsonb;
  v_sid   uuid;
  v_base  bigint;
  v_del   boolean;
  v_rec   jsonb;
  v_cur   public.saved_scales%rowtype;
  v_found boolean;
  v_res   jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if rows is null or jsonb_typeof(rows) <> 'array' then raise exception 'rows must be an array'; end if;
  if jsonb_array_length(rows) > 200 then raise exception 'too many rows'; end if;

  insert into public.sync_users (user_id) values (v_uid) on conflict do nothing;
  select last_rev into v_rev from public.sync_users where user_id = v_uid for update;

  select count(*) filter (where not deleted), count(*) into v_live, v_total
    from public.saved_scales where user_id = v_uid;
  select count(*) into v_hist from public.scale_history where user_id = v_uid;

  for v_item in select value from jsonb_array_elements(rows) loop
    v_sid  := (v_item ->> 'scale_id')::uuid;
    v_base := (v_item ->> 'base_rev')::bigint;
    v_del  := coalesce((v_item ->> 'deleted')::boolean, false);
    v_rec  := case when jsonb_typeof(v_item -> 'record') = 'object' then v_item -> 'record' else null end;
    v_res  := null;

    select * into v_cur from public.saved_scales where user_id = v_uid and scale_id = v_sid;
    v_found := found;

    if not v_del and v_rec is null then
      v_res := jsonb_build_object('scale_id', v_sid, 'refused', 'invalid');
    elsif v_rec is not null and octet_length(v_rec::text) > 8192 then
      v_res := jsonb_build_object('scale_id', v_sid, 'refused', 'size');
    elsif not v_found then
      if v_del then
        v_res := jsonb_build_object('scale_id', v_sid, 'refused', 'unknown');
      elsif v_base is not null then
        v_res := jsonb_build_object('scale_id', v_sid, 'conflict', true);
      elsif v_live >= 500 or v_total >= 5000 then
        v_res := jsonb_build_object('scale_id', v_sid, 'refused', 'cap');
      else
        v_rev := v_rev + 1;
        insert into public.saved_scales (user_id, scale_id, rev, record, deleted, updated_at)
          values (v_uid, v_sid, v_rev, v_rec, false, now());
        v_live := v_live + 1;
        v_total := v_total + 1;
        v_res := jsonb_build_object('scale_id', v_sid, 'rev', v_rev);
      end if;
    elsif v_base is null and not v_cur.deleted then
      v_res := jsonb_build_object('scale_id', v_sid, 'conflict', true);
    elsif v_base is not null and v_base <> v_cur.rev then
      v_res := jsonb_build_object('scale_id', v_sid, 'conflict', true);
    elsif v_rec is not null and v_cur.record is not null and v_hist >= 2000 then
      v_res := jsonb_build_object('scale_id', v_sid, 'refused', 'rate');
    elsif not v_del and v_cur.deleted and v_live >= 500 then
      v_res := jsonb_build_object('scale_id', v_sid, 'refused', 'cap');
    else
      if v_rec is not null and v_cur.record is not null then
        insert into public.scale_history (user_id, scale_id, record) values (v_uid, v_sid, v_cur.record);
        v_hist := v_hist + 1;
      end if;
      v_rev := v_rev + 1;
      if v_del then
        update public.saved_scales
           set rev = v_rev, record = coalesce(v_rec, v_cur.record), deleted = true,
               deleted_at = case when v_cur.deleted then v_cur.deleted_at else now() end, updated_at = now()
         where user_id = v_uid and scale_id = v_sid;
        if not v_cur.deleted then v_live := v_live - 1; end if;
      else
        update public.saved_scales
           set rev = v_rev, record = v_rec, deleted = false, deleted_at = null, updated_at = now()
         where user_id = v_uid and scale_id = v_sid;
        if v_cur.deleted then v_live := v_live + 1; end if;
      end if;
      v_res := jsonb_build_object('scale_id', v_sid, 'rev', v_rev);
    end if;

    v_out := v_out || jsonb_build_array(v_res);
  end loop;

  update public.sync_users set last_rev = v_rev where user_id = v_uid;
  return v_out;
end;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- purge_tombstones(): bodies of tombstones older than 30 days are cleared (the row stays forever),
-- history rows older than 30 days are deleted. Runs as sync_purger or pg_cron; no user context.
create or replace function public.purge_tombstones()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bodies  integer;
  v_history integer;
begin
  update public.saved_scales set record = null
   where deleted and record is not null and deleted_at < now() - interval '30 days';
  get diagnostics v_bodies = row_count;
  delete from public.scale_history where replaced_at < now() - interval '30 days';
  get diagnostics v_history = row_count;
  return jsonb_build_object('bodies_cleared', v_bodies, 'history_deleted', v_history);
end;
$$;

alter function public.push_scales(jsonb)     owner to postgres;
alter function public.delete_my_account()    owner to postgres;
alter function public.purge_tombstones()     owner to postgres;

revoke execute on function public.push_scales(jsonb)  from public, anon;
grant  execute on function public.push_scales(jsonb)  to authenticated;
revoke execute on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;
revoke execute on function public.purge_tombstones()  from public, anon, authenticated;
grant  execute on function public.purge_tombstones()  to sync_purger;

-- Optional scheduled purge when pg_cron is available (V7):
--   select cron.schedule('sync-purge', '17 3 * * *', 'select public.purge_tombstones()');

-- Recovery (plan section 16). Run as one transaction in the SQL editor; replace :u, :s and :t.
-- Mass tombstone, within 30 days:
--   begin;
--   with n as (select count(*) c from public.saved_scales
--               where user_id = :u and deleted and record is not null and deleted_at > now() - interval '30 days'),
--        s as (update public.sync_users set last_rev = last_rev + (select c from n)
--               where user_id = :u returning last_rev - (select c from n) as base),
--        r as (select scale_id, row_number() over (order by rev) as k from public.saved_scales
--               where user_id = :u and deleted and record is not null and deleted_at > now() - interval '30 days')
--   update public.saved_scales t set deleted = false, deleted_at = null, updated_at = now(),
--          rev = (select base from s) + r.k
--     from r where t.user_id = :u and t.scale_id = r.scale_id;
--   commit;
-- Junk overwrite: restore one version from history with a fresh rev. First check the select returns a
-- row (no match would null the live record, so the update is guarded), and copy the current body into
-- history before replacing it.
--   begin;
--   insert into public.scale_history (user_id, scale_id, record, replaced_at)
--     select user_id, scale_id, record, now() from public.saved_scales
--      where user_id = :u and scale_id = :s and record is not null;
--   update public.sync_users set last_rev = last_rev + 1 where user_id = :u;
--   update public.saved_scales set record = h.record,
--          rev = (select last_rev from public.sync_users where user_id = :u), deleted = false, deleted_at = null,
--          updated_at = now()
--     from (select record from public.scale_history
--            where user_id = :u and scale_id = :s and replaced_at < :t order by replaced_at desc, id desc limit 1) h
--    where user_id = :u and scale_id = :s;
--   commit;
