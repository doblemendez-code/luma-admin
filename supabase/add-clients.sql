create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  instagram text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.appointments
add column if not exists client_id uuid references public.clients(id) on delete set null;

alter table public.service_records
add column if not exists client_id uuid references public.clients(id) on delete set null;

alter table public.clients enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'clients'
      and policyname = 'business users read clients'
  ) then
    create policy "business users read clients"
    on public.clients for select
    to authenticated
    using (public.current_role() in ('admin', 'business'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'clients'
      and policyname = 'business users insert clients'
  ) then
    create policy "business users insert clients"
    on public.clients for insert
    to authenticated
    with check (public.current_role() in ('admin', 'business'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'clients'
      and policyname = 'business users update clients'
  ) then
    create policy "business users update clients"
    on public.clients for update
    to authenticated
    using (public.current_role() = 'admin')
    with check (public.current_role() = 'admin');
  end if;
end $$;

create index if not exists appointments_client_id_idx on public.appointments (client_id);
create index if not exists clients_full_name_idx on public.clients (full_name);
create index if not exists service_records_client_id_idx on public.service_records (client_id);
