begin;
create table public.gmail_connections(owner_id uuid primary key references auth.users(id) on delete cascade,email text not null,refresh_cipher text not null,last_sync timestamptz,scan_after bigint,scan_before bigint,page_token text,last_error text,created_at timestamptz not null default now());
alter table public.gmail_connections enable row level security;
revoke all on public.gmail_connections from public,anon,authenticated;
create table public.gmail_oauth_states(state_hash text primary key,owner_id uuid not null references auth.users(id) on delete cascade,expires_at timestamptz not null);
alter table public.gmail_oauth_states enable row level security;
revoke all on public.gmail_oauth_states from public,anon,authenticated;
create table public.reservation_inbox(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,provider text not null,source_message_id text not null,source_url text not null,candidate jsonb not null,status text not null default 'review' check(status in ('review','imported','ignored')),created_at timestamptz not null default now(),unique(owner_id,source_message_id));
alter table public.reservation_inbox enable row level security;
revoke all on public.reservation_inbox from public,anon,authenticated;
grant select on public.reservation_inbox to authenticated;
create policy "Read own reservation inbox" on public.reservation_inbox for select to authenticated using(owner_id=(select auth.uid()));
create table public.reservation_email_deliveries(owner_id uuid not null references auth.users(id) on delete cascade,delivery_key text not null,status text not null check(status in ('sending','sent','uncertain')),created_at timestamptz not null default now(),primary key(owner_id,delivery_key));
alter table public.reservation_email_deliveries enable row level security;
revoke all on public.reservation_email_deliveries from public,anon,authenticated;
grant select, update on public.user_workspaces to service_role;
-- Only the backend service may access tokens or perform imports. No token is returned to a browser.
grant all on public.gmail_connections,public.gmail_oauth_states,public.reservation_inbox,public.reservation_email_deliveries to service_role;
create function public.commit_reservation_import(p_owner uuid,p_import uuid,p_expedition text,p_booking jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare workspace jsonb; rows jsonb; previous jsonb; next_booking jsonb; rev bigint;
begin
 perform 1 from public.reservation_inbox where id=p_import and owner_id=p_owner and status='review' for update;
 if not found then raise exception 'Import is no longer available';end if;
 select payload,revision into workspace,rev from public.user_workspaces where owner_id=p_owner for update;
 if workspace is null or not(workspace->'records' ? p_expedition) then raise exception 'Expedition not found';end if;
 rows:=workspace->'records'->p_expedition->'bookings';
 select value into previous from jsonb_array_elements(rows) where coalesce(p_booking->>'reference','')<>'' and value->>'bookingSource'=p_booking->>'bookingSource' and value->>'reference'=p_booking->>'reference' limit 1;
 next_booking:=coalesce(previous,'{}'::jsonb)||p_booking;
 if previous is null and not(next_booking ? 'emailReminder') then next_booking:=jsonb_set(next_booking,'{emailReminder}','true'::jsonb);end if;
 if previous is not null then
 next_booking:=jsonb_set(next_booking,'{id}',previous->'id');
 if previous ? 'notes' then next_booking:=jsonb_set(next_booking,'{notes}',previous->'notes');end if;
 if coalesce(p_booking->>'propertyName','')='' and previous ? 'title' then next_booking:=jsonb_set(next_booking,'{title}',previous->'title');end if;
 end if;
 select coalesce(jsonb_agg(value),'[]'::jsonb) into rows from jsonb_array_elements(rows) where value->>'id'<>next_booking->>'id';
 rows:=rows||jsonb_build_array(next_booking);
 workspace:=jsonb_set(workspace,array['records',p_expedition,'bookings'],rows);
 workspace:=jsonb_set(workspace,'{revision}',to_jsonb(rev+1));
 update public.user_workspaces set payload=workspace,revision=rev+1,updated_at=now() where owner_id=p_owner;
 update public.reservation_inbox set status='imported' where id=p_import and owner_id=p_owner;
end;$$;
revoke all on function public.commit_reservation_import(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.commit_reservation_import(uuid,uuid,text,jsonb) to service_role;
commit;
