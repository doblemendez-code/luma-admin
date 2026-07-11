-- Limpia los datos operativos para empezar pruebas desde cero.
-- No borra usuarios de Supabase Auth ni perfiles de Nancy/manicuristas.

truncate table public.service_records restart identity cascade;
truncate table public.appointments restart identity cascade;
truncate table public.expenses restart identity cascade;
truncate table public.clients restart identity cascade;
