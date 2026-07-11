-- Ejecuta este archivo en Supabase SQL Editor si las citas fallan por RLS
-- o si una manicurista puede ver/modificar mas informacion de la que debe.

create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.employees enable row level security;
alter table public.appointments enable row level security;
alter table public.service_records enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "profiles can read own profile" on public.profiles;
create policy "profiles can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "business users read clients" on public.clients;
drop policy if exists "business users insert clients" on public.clients;
drop policy if exists "business users update clients" on public.clients;
drop policy if exists "authenticated users read clients" on public.clients;
drop policy if exists "authenticated users insert clients" on public.clients;
drop policy if exists "authenticated users update clients" on public.clients;
drop policy if exists "admin and business read clients" on public.clients;
drop policy if exists "admin inserts clients" on public.clients;
drop policy if exists "admin and business insert clients" on public.clients;
drop policy if exists "admin updates clients" on public.clients;

create policy "admin and business read clients"
on public.clients for select
to authenticated
using (public.current_role() in ('admin', 'business'));

create policy "admin and business insert clients"
on public.clients for insert
to authenticated
with check (public.current_role() = 'admin');

create policy "admin updates clients"
on public.clients for update
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "admin reads employees" on public.employees;
drop policy if exists "admin inserts employees" on public.employees;
drop policy if exists "admin updates employees" on public.employees;

create policy "admin reads employees"
on public.employees for select
to authenticated
using (public.current_role() = 'admin' or (public.current_role() = 'business' and is_active));

create policy "admin inserts employees"
on public.employees for insert
to authenticated
with check (public.current_role() = 'admin');

create policy "admin updates employees"
on public.employees for update
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "business users read appointments" on public.appointments;
drop policy if exists "business users insert appointments" on public.appointments;
drop policy if exists "business users update appointments" on public.appointments;
drop policy if exists "admin and business read appointments" on public.appointments;
drop policy if exists "admin and business insert appointments" on public.appointments;
drop policy if exists "admin and business update appointments" on public.appointments;

create policy "admin and business read appointments"
on public.appointments for select
to authenticated
using (public.current_role() in ('admin', 'business'));

create policy "admin and business insert appointments"
on public.appointments for insert
to authenticated
with check (public.current_role() in ('admin', 'business'));

create policy "admin and business update appointments"
on public.appointments for update
to authenticated
using (public.current_role() in ('admin', 'business'))
with check (public.current_role() in ('admin', 'business'));

drop policy if exists "business users read services" on public.service_records;
drop policy if exists "business users insert services" on public.service_records;
drop policy if exists "business users update services" on public.service_records;
drop policy if exists "admin reads services" on public.service_records;
drop policy if exists "admin and business read services" on public.service_records;
drop policy if exists "admin inserts services" on public.service_records;
drop policy if exists "admin and business inserts services" on public.service_records;
drop policy if exists "admin updates services" on public.service_records;

create policy "admin and business read services"
on public.service_records for select
to authenticated
using (public.current_role() in ('admin', 'business'));

create policy "admin and business inserts services"
on public.service_records for insert
to authenticated
with check (public.current_role() in ('admin', 'business'));

create policy "admin updates services"
on public.service_records for update
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "business users read expenses" on public.expenses;
drop policy if exists "business users insert expenses" on public.expenses;
drop policy if exists "business users update expenses" on public.expenses;
drop policy if exists "admin reads expenses" on public.expenses;
drop policy if exists "admin inserts expenses" on public.expenses;
drop policy if exists "admin updates expenses" on public.expenses;

create policy "admin reads expenses"
on public.expenses for select
to authenticated
using (public.current_role() = 'admin');

create policy "admin inserts expenses"
on public.expenses for insert
to authenticated
with check (public.current_role() = 'admin');

create policy "admin updates expenses"
on public.expenses for update
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

-- Verifica que existan perfiles para Nancy y Naomi. Si falta alguno,
-- sustituye los UUID por los IDs de Authentication > Users y ejecuta los inserts.
-- insert into public.profiles (id, email, full_name, role) values
-- ('UUID_NANCY', 'nancydm213@gmail.com', 'Nancy Medina', 'admin')
-- on conflict (id) do update set role = 'admin', full_name = excluded.full_name, email = excluded.email;
--
-- insert into public.profiles (id, email, full_name, role) values
-- ('UUID_NAOMI', 'yunonaomi18@gmail.com', 'Naomi Blancas Urrutia', 'business')
-- on conflict (id) do update set role = 'business', full_name = excluded.full_name, email = excluded.email;
