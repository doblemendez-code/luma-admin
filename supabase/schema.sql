create extension if not exists pgcrypto;

drop table if exists public.expenses cascade;
drop table if exists public.payroll_deductions cascade;
drop table if exists public.service_records cascade;
drop table if exists public.appointments cascade;
drop table if exists public.employees cascade;
drop table if exists public.clients cascade;
drop table if exists public.profiles cascade;
drop function if exists public.current_role();

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('admin', 'business')),
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  instagram text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text not null unique,
  salary numeric(10,2) not null default 0 check (salary >= 0),
  commission_rate numeric(5,4) not null default 0.30 check (commission_rate >= 0),
  deduct_card_fee boolean not null default true,
  monday_commission_rate numeric(5,4) not null default 0 check (monday_commission_rate >= 0),
  monday_salary numeric(10,2) not null default 0 check (monday_salary >= 0),
  monday_salary_mode text not null default 'none' check (monday_salary_mode in ('none', 'fixed', 'if_service')),
  tuesday_commission_rate numeric(5,4) not null default 0 check (tuesday_commission_rate >= 0),
  tuesday_salary numeric(10,2) not null default 0 check (tuesday_salary >= 0),
  tuesday_salary_mode text not null default 'none' check (tuesday_salary_mode in ('none', 'fixed', 'if_service')),
  wednesday_commission_rate numeric(5,4) not null default 0 check (wednesday_commission_rate >= 0),
  wednesday_salary numeric(10,2) not null default 0 check (wednesday_salary >= 0),
  wednesday_salary_mode text not null default 'none' check (wednesday_salary_mode in ('none', 'fixed', 'if_service')),
  thursday_commission_rate numeric(5,4) not null default 0 check (thursday_commission_rate >= 0),
  thursday_salary numeric(10,2) not null default 0 check (thursday_salary >= 0),
  thursday_salary_mode text not null default 'none' check (thursday_salary_mode in ('none', 'fixed', 'if_service')),
  friday_commission_rate numeric(5,4) not null default 0 check (friday_commission_rate >= 0),
  friday_salary numeric(10,2) not null default 0 check (friday_salary >= 0),
  friday_salary_mode text not null default 'none' check (friday_salary_mode in ('none', 'fixed', 'if_service')),
  saturday_commission_rate numeric(5,4) not null default 0 check (saturday_commission_rate >= 0),
  saturday_salary numeric(10,2) not null default 0 check (saturday_salary >= 0),
  saturday_salary_mode text not null default 'none' check (saturday_salary_mode in ('none', 'fixed', 'if_service')),
  sunday_commission_rate numeric(5,4) not null default 0 check (sunday_commission_rate >= 0),
  sunday_salary numeric(10,2) not null default 0 check (sunday_salary >= 0),
  sunday_salary_mode text not null default 'none' check (sunday_salary_mode in ('none', 'fixed', 'if_service')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  requested_service text not null,
  provider text not null,
  appointment_at timestamptz not null,
  contact_channel text not null check (contact_channel in ('WhatsApp', 'Instagram')),
  reschedule_count integer not null default 0 check (reschedule_count between 0 and 1),
  no_show boolean not null default false,
  canceled boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.service_records (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  service_name text not null,
  provider text not null,
  service_date date not null,
  cost numeric(10,2) not null check (cost >= 0),
  payment_method text not null check (payment_method in ('Transferencia', 'Efectivo', 'Tarjeta', 'Mixto')),
  cash_amount numeric(10,2) not null default 0 check (cash_amount >= 0),
  transfer_amount numeric(10,2) not null default 0 check (transfer_amount >= 0),
  card_amount numeric(10,2) not null default 0 check (card_amount >= 0),
  tip_amount numeric(10,2) not null default 0 check (tip_amount >= 0),
  tip_payment_method text check (tip_payment_method in ('Transferencia', 'Efectivo', 'Tarjeta')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  concept text not null,
  expense_date date not null,
  amount numeric(10,2) not null check (amount >= 0),
  payment_method text not null check (payment_method in ('Efectivo de caja', 'Transferencia')),
  category text not null check (category in ('Insumos', 'Limpieza', 'Renta', 'Otros')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.payroll_deductions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  employee_name text not null,
  deduction_date date not null,
  amount numeric(10,2) not null check (amount >= 0),
  reason text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.employees enable row level security;
alter table public.appointments enable row level security;
alter table public.service_records enable row level security;
alter table public.expenses enable row level security;
alter table public.payroll_deductions enable row level security;

create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create policy "profiles can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "business users read clients"
on public.clients for select
to authenticated
using (public.current_role() in ('admin', 'business'));

create policy "business users insert clients"
on public.clients for insert
to authenticated
with check (public.current_role() in ('admin', 'business'));

create policy "business users update clients"
on public.clients for update
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

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

create policy "business users read appointments"
on public.appointments for select
to authenticated
using (public.current_role() in ('admin', 'business'));

create policy "business users insert appointments"
on public.appointments for insert
to authenticated
with check (public.current_role() in ('admin', 'business'));

create policy "business users update appointments"
on public.appointments for update
to authenticated
using (public.current_role() in ('admin', 'business'));

create policy "business users read services"
on public.service_records for select
to authenticated
using (public.current_role() in ('admin', 'business'));

create policy "business users insert services"
on public.service_records for insert
to authenticated
with check (public.current_role() in ('admin', 'business'));

create policy "business users update services"
on public.service_records for update
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

create policy "business users read expenses"
on public.expenses for select
to authenticated
using (public.current_role() = 'admin');

create policy "business users insert expenses"
on public.expenses for insert
to authenticated
with check (public.current_role() = 'admin');

create policy "business users update expenses"
on public.expenses for update
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

create policy "admin reads payroll deductions"
on public.payroll_deductions for select
to authenticated
using (public.current_role() = 'admin');

create policy "admin inserts payroll deductions"
on public.payroll_deductions for insert
to authenticated
with check (public.current_role() = 'admin');

create policy "admin updates payroll deductions"
on public.payroll_deductions for update
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

create index appointments_appointment_at_idx on public.appointments (appointment_at);
create index appointments_client_id_idx on public.appointments (client_id);
create index clients_full_name_idx on public.clients (full_name);
create index employees_is_active_idx on public.employees (is_active);
create index appointments_canceled_idx on public.appointments (canceled);
create index service_records_service_date_idx on public.service_records (service_date);
create index service_records_client_id_idx on public.service_records (client_id);
create index expenses_expense_date_idx on public.expenses (expense_date);
create index payroll_deductions_date_idx on public.payroll_deductions (deduction_date);
create index payroll_deductions_employee_id_idx on public.payroll_deductions (employee_id);

-- Despues de crear Nancy y Naomi en Authentication > Users, sustituye los UUID.
-- insert into public.profiles (id, email, full_name, role) values
-- ('UUID_NANCY', 'nancydm213@gmail.com', 'Nancy Medina', 'admin'),
-- ('UUID_NAOMI', 'yunonaomi18@gmail.com', 'Naomi Blancas Urrutia', 'business');

-- Empleados iniciales, puedes cambiar sueldo/comision desde la app.
-- insert into public.employees (full_name, phone, email, deduct_card_fee, monday_commission_rate, monday_salary, monday_salary_mode, tuesday_commission_rate, tuesday_salary, tuesday_salary_mode, wednesday_commission_rate, wednesday_salary, wednesday_salary_mode, thursday_commission_rate, thursday_salary, thursday_salary_mode, friday_commission_rate, friday_salary, friday_salary_mode, saturday_commission_rate, saturday_salary, saturday_salary_mode, sunday_commission_rate, sunday_salary, sunday_salary_mode, is_active) values
-- ('Naomi Blancas Urrutia', null, 'yunonaomi18@gmail.com', true, 0.10, 360, 'if_service', 0.10, 360, 'if_service', 0.10, 500, 'fixed', 0.10, 500, 'fixed', 0.10, 500, 'fixed', 0.10, 500, 'fixed', 0, 0, 'none', true),
-- ('Alisson Osmara Méndez', null, 'alisson@example.com', true, 0.50, 0, 'none', 0.50, 0, 'none', 0.50, 0, 'none', 0.50, 0, 'none', 0.50, 0, 'none', 0.50, 0, 'none', 0, 0, 'none', true),
-- ('Carmen López García', null, 'carmen@example.com', true, 0.10, 360, 'if_service', 0.10, 360, 'if_service', 0.30, 0, 'none', 0.30, 0, 'none', 0.30, 0, 'none', 0.30, 0, 'none', 0, 0, 'none', true)
-- on conflict (email) do update set full_name = excluded.full_name, deduct_card_fee = excluded.deduct_card_fee;
