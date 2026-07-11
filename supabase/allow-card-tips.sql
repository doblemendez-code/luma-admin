-- Ejecuta este archivo si tu base de LUMA ya existe y quieres permitir
-- propinas pagadas con tarjeta en service_records.tip_payment_method.

alter table public.service_records
drop constraint if exists service_records_tip_payment_method_check;

alter table public.service_records
add constraint service_records_tip_payment_method_check
check (tip_payment_method in ('Transferencia', 'Efectivo', 'Tarjeta')) not valid;
