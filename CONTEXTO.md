# Contexto del Proyecto LUMA Admin

Ultima actualizacion: 2026-07-11

## Resumen

LUMA Admin es una app interna para administrar clientas, agenda, cierres de servicios, gastos, nomina y empleados de LUMA.

El proyecto esta en `LUMA/luma-admin` y fue construido con Next.js, React, Tailwind CSS y Supabase.

## Stack Tecnico

- Next.js `16.2.9`
- React `19.2.4`
- TypeScript
- Tailwind CSS `4`
- Supabase Auth + Postgres

## Comandos

- Instalar dependencias: `npm install`
- Desarrollo local: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`

## Variables de Entorno

El archivo `.env.local` debe contener:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

Si estas variables no existen, la app muestra una pantalla de configuracion indicando que falta conectar Supabase.

## Usuarios y Permisos

La app usa perfiles en Supabase con roles:

- `admin`: acceso completo.
- `business`: operacion diaria.

Estado actual:

- El rol `admin` ve dashboard, clientas, agenda, calendario, gastos, empleados, respaldos JSON y exportaciones CSV.
- El rol `business` ve clientas, agenda y calendario.
- El rol `business` puede crear clientas, crear citas, leer empleados activos y cerrar servicios.
- El rol `business` no ve dashboard financiero, gastos, empleados ni respaldos.
- Solo `admin` puede editar clientas, cancelar citas, registrar gastos, registrar descuentos de nomina y administrar empleados.

## Modulos Implementados

### Dashboard

Vista semanal para `admin`. Se selecciona cualquier dia y la app calcula la semana de lunes a domingo.

Muestra:

- Total vendido.
- Total de clientas.
- Gastos LUMA.
- Pago del equipo.
- Saldo disponible.
- Panel del sabado con pagos por prestadora y resumen del negocio.

Reglas de calculo actuales:

- Ventas: suma de servicios cerrados en la semana.
- Gastos: suma de gastos en la semana.
- Pago por prestadora: sueldo + comisiones + propinas - fee de tarjeta - descuentos de nomina.
- Fee de tarjeta: `4.18%` sobre el monto de servicio pagado con tarjeta y sobre propinas pagadas con tarjeta, si el empleado tiene activado `deduct_card_fee`.
- Comision y sueldo se calculan por dia usando las reglas configurables del empleado.
- Saldo disponible: ventas - pago del equipo - gastos.

### Clientas

Permite registrar, buscar y consultar clientas con:

- Nombre completo.
- Telefono.
- Instagram.
- Notas.
- Citas registradas.
- Historial de servicios.
- Total gastado.
- Ultima visita.

Las clientas se crean desde el modal `Agregar clienta`. El rol `admin` tambien puede editar datos de clienta desde la ficha.

La tabla principal es `clients`.

### Agenda

Permite crear citas y cerrar servicios.

Campos de cita:

- Clienta existente.
- Servicio solicitado.
- Prestadora.
- Fecha y hora.
- Canal: `WhatsApp` o `Instagram`.

Para cerrar servicio primero se selecciona una clienta y despues una cita pendiente de cierre de esa clienta.

Campos de cierre:

- Cita pendiente relacionada.
- Servicio realizado.
- Prestadora.
- Fecha.
- Costo.
- Forma de pago: `Transferencia`, `Efectivo`, `Tarjeta` o `Mixto`.
- Desglose de efectivo, transferencia y tarjeta cuando el pago es mixto.
- Propina.
- Forma de pago de propina: `Transferencia`, `Efectivo` o `Tarjeta`.
- Observaciones.

Las tablas principales son `appointments` y `service_records`.

Nota de zona horaria: el valor del campo `datetime-local` de las citas se convierte a ISO usando la zona local del navegador antes de guardarse en Supabase. Esto evita que una cita capturada como 4:30 pm se muestre como 10:30 am por interpretarse como UTC.

### Calendario Mensual

Vista mensual con dias clickeables. Cada dia muestra la cantidad de citas activas.

Al abrir un dia se muestra:

- Hora.
- Clienta.
- Servicio solicitado.
- Prestadora.
- Canal.
- Estado operativo: `Cancelada`, `No asistio`, `Servicio cerrado` o `Pendiente de cierre`.

Si la cita esta pendiente, se puede seleccionar para cerrarla desde Agenda. Solo `admin` puede cancelar citas desde el calendario.

### Gastos

Modulo solo para `admin`.

Permite registrar egresos con:

- Concepto.
- Fecha.
- Monto.
- Forma de pago: `Efectivo de caja` o `Transferencia`.
- Categoria: `Insumos`, `Limpieza`, `Renta` u `Otros`.

Tambien muestra resumen semanal por categoria y forma de pago, ultimos gastos y descuentos de nomina de la semana.

La tabla principal es `expenses`.

### Empleados

Modulo solo para `admin`.

Permite crear, editar, inactivar y reactivar empleados.

Campos principales:

- Nombre completo.
- Telefono.
- Correo.
- Si se descuenta fee de tarjeta.
- Reglas por dia de la semana: comision, sueldo y modo de sueldo.

Modos de sueldo:

- `none`: no pagar sueldo ese dia.
- `fixed`: se paga siempre.
- `if_service`: solo se paga si trabajo ese dia.

Los empleados activos aparecen como prestadoras en agenda, calendario y calculos de pago.

La tabla principal es `employees`.

### Descuentos de Nomina

Modulo accesible desde Gastos para `admin`.

Permite registrar descuentos por empleado con:

- Empleada.
- Fecha.
- Monto.
- Razon.

Los descuentos se restan del pago semanal del empleado.

La tabla principal es `payroll_deductions`.

### Respaldos

Solo `admin` puede exportar:

- Respaldo JSON completo.
- CSV separados para clientas, citas, servicios, gastos, descuentos de nomina y empleados.

## Base de Datos

El esquema principal esta en `supabase/schema.sql`.

Tablas:

- `profiles`
- `clients`
- `employees`
- `appointments`
- `service_records`
- `expenses`
- `payroll_deductions`

RLS:

- Todas las tablas principales tienen Row Level Security activado.
- `profiles`: cada usuario lee su propio perfil.
- `clients`: `admin` y `business` leen e insertan; solo `admin` actualiza.
- `employees`: `admin` administra; `business` solo lee empleados activos.
- `appointments`: `admin` y `business` leen, insertan y actualizan.
- `service_records`: `admin` y `business` leen e insertan; solo `admin` actualiza.
- `expenses`: solo `admin` lee, inserta y actualiza.
- `payroll_deductions`: solo `admin` lee, inserta y actualiza.

Indices relevantes:

- `appointments_appointment_at_idx`
- `appointments_client_id_idx`
- `clients_full_name_idx`
- `employees_is_active_idx`
- `appointments_canceled_idx`
- `service_records_service_date_idx`
- `service_records_client_id_idx`
- `expenses_expense_date_idx`
- `payroll_deductions_date_idx`
- `payroll_deductions_employee_id_idx`

## Archivos Clave

- `src/app/page.tsx`: app principal, UI, formularios, calculos semanales y exportaciones.
- `src/app/globals.css`: estilos globales y tokens visuales de marca LUMA.
- `src/app/layout.tsx`: metadata y layout raiz.
- `src/lib/supabase.ts`: inicializacion del cliente Supabase.
- `src/lib/types.ts`: tipos principales del dominio.
- `supabase/schema.sql`: esquema completo de base de datos y politicas RLS.
- `supabase/add-clients.sql`: migracion auxiliar para clientas.
- `supabase/fix-clients-rls.sql`: ajuste auxiliar para politicas de clientas.
- `supabase/fix-role-permissions.sql`: ajuste auxiliar de permisos por rol.
- `supabase/allow-card-tips.sql`: ajuste pequeno para permitir propinas pagadas con tarjeta en una base ya existente.
- `supabase/update-after-first-schema.sql`: migracion auxiliar posterior al primer esquema.
- `supabase/reset-data.sql`: script auxiliar para reiniciar datos.
- `AGENTS.md`: regla importante para agentes: revisar docs locales de Next.js antes de tocar codigo porque esta version puede tener cambios incompatibles.

## Pendientes o Consideraciones

- El campo `reschedule_count` existe en BD, pero no hay flujo UI completo para reagendar.
- El campo `no_show` existe en BD, pero no se observa accion UI para marcar no show.
- No hay integracion con Google Calendar.
- La app actual esta concentrada en un solo componente grande (`src/app/page.tsx`); futuras mejoras pueden separar componentes solo si hace falta para mantener claridad.
- Antes de modificar codigo Next.js, revisar documentacion local en `node_modules/next/dist/docs/` por la regla de `AGENTS.md`.
