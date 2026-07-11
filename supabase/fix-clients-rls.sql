drop policy if exists "business users read clients" on public.clients;
drop policy if exists "business users insert clients" on public.clients;
drop policy if exists "business users update clients" on public.clients;
drop policy if exists "authenticated users read clients" on public.clients;
drop policy if exists "authenticated users insert clients" on public.clients;
drop policy if exists "authenticated users update clients" on public.clients;

create policy "business users read clients"
on public.clients for select
to authenticated
using (public.current_role() in ('admin', 'business'));

create policy "business users insert clients"
on public.clients for insert
to authenticated
with check (public.current_role() in ('admin', 'business'));

create policy "admin updates clients"
on public.clients for update
to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');
