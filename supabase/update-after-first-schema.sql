-- Corre este archivo si ya ejecutaste el primer schema de LUMA.
-- Ajusta permisos de clientas, quita anticipo, actualiza manicuristas y agrega empleados.

create extension if not exists pgcrypto;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text not null unique,
  salary numeric(10,2) not null default 0 check (salary >= 0),
  commission_rate numeric(5,4) not null default 0.30 check (commission_rate >= 0),
  deduct_card_fee boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.employees enable row level security;

create table if not exists public.payroll_deductions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  employee_name text not null,
  deduction_date date not null,
  amount numeric(10,2) not null check (amount >= 0),
  reason text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.payroll_deductions enable row level security;

alter table public.employees add column if not exists salary numeric(10,2) not null default 0 check (salary >= 0);
alter table public.employees add column if not exists commission_rate numeric(5,4) not null default 0.30 check (commission_rate >= 0);
alter table public.employees add column if not exists deduct_card_fee boolean not null default true;
alter table public.employees add column if not exists monday_commission_rate numeric(5,4) not null default 0 check (monday_commission_rate >= 0);
alter table public.employees add column if not exists monday_salary numeric(10,2) not null default 0 check (monday_salary >= 0);
alter table public.employees add column if not exists monday_salary_mode text not null default 'none' check (monday_salary_mode in ('none', 'fixed', 'if_service'));
alter table public.employees add column if not exists tuesday_commission_rate numeric(5,4) not null default 0 check (tuesday_commission_rate >= 0);
alter table public.employees add column if not exists tuesday_salary numeric(10,2) not null default 0 check (tuesday_salary >= 0);
alter table public.employees add column if not exists tuesday_salary_mode text not null default 'none' check (tuesday_salary_mode in ('none', 'fixed', 'if_service'));
alter table public.employees add column if not exists wednesday_commission_rate numeric(5,4) not null default 0 check (wednesday_commission_rate >= 0);
alter table public.employees add column if not exists wednesday_salary numeric(10,2) not null default 0 check (wednesday_salary >= 0);
alter table public.employees add column if not exists wednesday_salary_mode text not null default 'none' check (wednesday_salary_mode in ('none', 'fixed', 'if_service'));
alter table public.employees add column if not exists thursday_commission_rate numeric(5,4) not null default 0 check (thursday_commission_rate >= 0);
alter table public.employees add column if not exists thursday_salary numeric(10,2) not null default 0 check (thursday_salary >= 0);
alter table public.employees add column if not exists thursday_salary_mode text not null default 'none' check (thursday_salary_mode in ('none', 'fixed', 'if_service'));
alter table public.employees add column if not exists friday_commission_rate numeric(5,4) not null default 0 check (friday_commission_rate >= 0);
alter table public.employees add column if not exists friday_salary numeric(10,2) not null default 0 check (friday_salary >= 0);
alter table public.employees add column if not exists friday_salary_mode text not null default 'none' check (friday_salary_mode in ('none', 'fixed', 'if_service'));
alter table public.employees add column if not exists saturday_commission_rate numeric(5,4) not null default 0 check (saturday_commission_rate >= 0);
alter table public.employees add column if not exists saturday_salary numeric(10,2) not null default 0 check (saturday_salary >= 0);
alter table public.employees add column if not exists saturday_salary_mode text not null default 'none' check (saturday_salary_mode in ('none', 'fixed', 'if_service'));
alter table public.employees add column if not exists sunday_commission_rate numeric(5,4) not null default 0 check (sunday_commission_rate >= 0);
alter table public.employees add column if not exists sunday_salary numeric(10,2) not null default 0 check (sunday_salary >= 0);
alter table public.employees add column if not exists sunday_salary_mode text not null default 'none' check (sunday_salary_mode in ('none', 'fixed', 'if_service'));
alter table public.appointments add column if not exists canceled boolean not null default false;
alter table public.service_records add column if not exists cash_amount numeric(10,2) not null default 0 check (cash_amount >= 0);
alter table public.service_records add column if not exists transfer_amount numeric(10,2) not null default 0 check (transfer_amount >= 0);
alter table public.service_records add column if not exists card_amount numeric(10,2) not null default 0 check (card_amount >= 0);
alter table public.service_records drop constraint if exists service_records_payment_method_check;
alter table public.service_records add constraint service_records_payment_method_check check (payment_method in ('Transferencia', 'Efectivo', 'Tarjeta', 'Mixto')) not valid;

alter table public.appointments drop column if exists deposit_status;
alter table public.appointments drop column if exists deposit_payment_method;
alter table public.service_records drop column if exists deposit_applied;

alter table public.appointments drop constraint if exists appointments_provider_check;
alter table public.service_records drop constraint if exists service_records_provider_check;

create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

drop policy if exists "business users insert clients" on public.clients;
drop policy if exists "admin inserts clients" on public.clients;
drop policy if exists "admin and business insert clients" on public.clients;
drop policy if exists "authenticated users insert clients" on public.clients;

create policy "business users insert clients"
on public.clients for insert
to authenticated
with check (public.current_role() in ('admin', 'business'));

drop policy if exists "business users update clients" on public.clients;
drop policy if exists "admin updates clients" on public.clients;
drop policy if exists "authenticated users update clients" on public.clients;

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

drop policy if exists "admin reads payroll deductions" on public.payroll_deductions;
drop policy if exists "admin inserts payroll deductions" on public.payroll_deductions;
drop policy if exists "admin updates payroll deductions" on public.payroll_deductions;

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

create index if not exists employees_is_active_idx on public.employees (is_active);
create index if not exists appointments_canceled_idx on public.appointments (canceled);
create index if not exists payroll_deductions_date_idx on public.payroll_deductions (deduction_date);
create index if not exists payroll_deductions_employee_id_idx on public.payroll_deductions (employee_id);

insert into public.employees (full_name, phone, email, deduct_card_fee, monday_commission_rate, monday_salary, monday_salary_mode, tuesday_commission_rate, tuesday_salary, tuesday_salary_mode, wednesday_commission_rate, wednesday_salary, wednesday_salary_mode, thursday_commission_rate, thursday_salary, thursday_salary_mode, friday_commission_rate, friday_salary, friday_salary_mode, saturday_commission_rate, saturday_salary, saturday_salary_mode, sunday_commission_rate, sunday_salary, sunday_salary_mode, is_active) values
('Naomi Blancas Urrutia', null, 'yunonaomi18@gmail.com', true, 0.10, 360, 'if_service', 0.10, 360, 'if_service', 0.10, 500, 'fixed', 0.10, 500, 'fixed', 0.10, 500, 'fixed', 0.10, 500, 'fixed', 0, 0, 'none', true),
('Alisson Osmara Méndez', null, 'alisson@example.com', true, 0.50, 0, 'none', 0.50, 0, 'none', 0.50, 0, 'none', 0.50, 0, 'none', 0.50, 0, 'none', 0.50, 0, 'none', 0, 0, 'none', true),
('Carmen López García', null, 'carmen@example.com', true, 0.10, 360, 'if_service', 0.10, 360, 'if_service', 0.30, 0, 'none', 0.30, 0, 'none', 0.30, 0, 'none', 0.30, 0, 'none', 0, 0, 'none', true)
on conflict (email) do update set full_name = excluded.full_name, deduct_card_fee = excluded.deduct_card_fee, monday_commission_rate = excluded.monday_commission_rate, monday_salary = excluded.monday_salary, monday_salary_mode = excluded.monday_salary_mode, tuesday_commission_rate = excluded.tuesday_commission_rate, tuesday_salary = excluded.tuesday_salary, tuesday_salary_mode = excluded.tuesday_salary_mode, wednesday_commission_rate = excluded.wednesday_commission_rate, wednesday_salary = excluded.wednesday_salary, wednesday_salary_mode = excluded.wednesday_salary_mode, thursday_commission_rate = excluded.thursday_commission_rate, thursday_salary = excluded.thursday_salary, thursday_salary_mode = excluded.thursday_salary_mode, friday_commission_rate = excluded.friday_commission_rate, friday_salary = excluded.friday_salary, friday_salary_mode = excluded.friday_salary_mode, saturday_commission_rate = excluded.saturday_commission_rate, saturday_salary = excluded.saturday_salary, saturday_salary_mode = excluded.saturday_salary_mode, sunday_commission_rate = excluded.sunday_commission_rate, sunday_salary = excluded.sunday_salary, sunday_salary_mode = excluded.sunday_salary_mode;

-- Sustituye los UUID por los IDs de Authentication > Users.
-- insert into public.profiles (id, email, full_name, role) values
-- ('UUID_NANCY', 'nancydm213@gmail.com', 'Nancy Medina', 'admin')
-- on conflict (id) do update set role = 'admin', full_name = excluded.full_name, email = excluded.email;
--
-- insert into public.profiles (id, email, full_name, role) values
-- ('UUID_NAOMI', 'yunonaomi18@gmail.com', 'Naomi Blancas Urrutia', 'business')
-- on conflict (id) do update set role = 'business', full_name = excluded.full_name, email = excluded.email;
