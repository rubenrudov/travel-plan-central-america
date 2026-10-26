-- Apply once using the Supabase SQL editor. No credentials belong in this file.
begin;
create table public.user_workspaces (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 0 check (revision >= 0),
 payload jsonb not null,
 updated_at timestamptz not null default now(),
 constraint valid_workspace check (
  jsonb_typeof(payload)='object'
  and payload ?& array['version','revision','activeId','expeditions','records']
  and payload->>'version'='1'
  and (payload->>'revision')::bigint=revision
  and jsonb_typeof(payload->'expeditions')='array'
  and jsonb_typeof(payload->'records')='object'
  and jsonb_typeof(payload->'activeId')='string'
 )
);
alter table public.user_workspaces enable row level security;
create policy "Read own workspace" on public.user_workspaces for select to authenticated using (owner_id=(select auth.uid()));
create policy "Create own workspace" on public.user_workspaces for insert to authenticated with check (owner_id=(select auth.uid()));
create policy "Update own workspace" on public.user_workspaces for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
revoke all on public.user_workspaces from public,anon;
grant select,insert,update on public.user_workspaces to authenticated;

create function public.load_or_create_workspace(p_seed jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise insufficient_privilege using message='Sign in first'; end if;
 insert into public.user_workspaces(owner_id,revision,payload)
 values(auth.uid(),0,jsonb_set(p_seed,'{revision}','0'::jsonb))
 on conflict(owner_id) do nothing;
 select payload into result from public.user_workspaces where owner_id=auth.uid();
 return result;
end;
$$;
create function public.save_workspace(p_state jsonb,p_expected_revision bigint) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise insufficient_privilege using message='Sign in first'; end if;
 update public.user_workspaces
 set payload=jsonb_set(p_state,'{revision}',to_jsonb(p_expected_revision+1)),revision=p_expected_revision+1,updated_at=now()
 where owner_id=auth.uid() and revision=p_expected_revision
 returning payload into result;
 if result is null then raise sqlstate 'PT409' using message='Conflict: reload to get the latest changes'; end if;
 return result;
end;
$$;
revoke all on function public.load_or_create_workspace(jsonb) from public,anon;
revoke all on function public.save_workspace(jsonb,bigint) from public,anon;
grant execute on function public.load_or_create_workspace(jsonb) to authenticated;
grant execute on function public.save_workspace(jsonb,bigint) to authenticated;
commit;
