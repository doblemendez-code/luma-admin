"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Appointment, Client, Employee, Expense, PayrollDeduction, Profile, SalaryMode, ServiceRecord } from "@/lib/types";

const providers = ["Naomi Blancas Urrutia", "Alisson Osmara Méndez", "Carmen López García"] as const;
const services = ["Manicure", "Pedicure", "Gel", "Acrilico", "Diseno", "Retoque"];
const cardFeeRate = 0.0418;
const weekDays = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miercoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sabado" },
  { key: "sunday", label: "Domingo" },
] as const;
type WeekDayKey = (typeof weekDays)[number]["key"];
const modules = [
  { id: "dashboard", label: "Dashboard" },
  { id: "clients", label: "Clientas" },
  { id: "appointments", label: "Agenda" },
  { id: "calendar", label: "Calendario" },
  { id: "expenses", label: "Gastos" },
  { id: "employees", label: "Empleados" },
] as const;
type ModuleId = (typeof modules)[number]["id"];

const appShell = "min-h-screen bg-[radial-gradient(circle_at_12%_0%,rgba(138,150,109,0.30),transparent_34rem),linear-gradient(135deg,#d9dbbc_0%,#ffffff_55%,#cac5a7_100%)] px-4 py-6 text-[#26301d] md:px-8";
const primaryButton = "rounded-full bg-[#4c5638] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3f482f]";
const secondaryButton = "rounded-full border border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20";

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value || 0);
}

function startOfWeek(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day + 1);
  return copy;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function displayDate(date: Date) {
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\n");
}

function dayKeyFromDate(value: string): WeekDayKey {
  const day = new Date(`${value}T00:00:00`).getDay();
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][day] as WeekDayKey;
}

function employeeNumber(employee: Employee, field: `${WeekDayKey}_commission_rate` | `${WeekDayKey}_salary`) {
  return Number(employee[field] ?? 0);
}

function employeeSalaryMode(employee: Employee, field: `${WeekDayKey}_salary_mode`) {
  return (employee[field] ?? "none") as SalaryMode;
}

function employeePayload(formData: FormData) {
  const payload: Record<string, string | number | boolean | null | undefined> = {
    full_name: String(formData.get("full_name") || "").trim(),
    phone: String(formData.get("phone") || "").trim() || null,
    email: String(formData.get("email") || "").trim().toLowerCase(),
    deduct_card_fee: formData.get("deduct_card_fee") === "on",
  };
  for (const day of weekDays) {
    payload[`${day.key}_commission_rate`] = Number(formData.get(`${day.key}_commission_rate`) || 0) / 100;
    payload[`${day.key}_salary`] = Number(formData.get(`${day.key}_salary`) || 0);
    payload[`${day.key}_salary_mode`] = String(formData.get(`${day.key}_salary_mode`) || "none");
  }
  return payload;
}

function salaryModeLabel(value: SalaryMode) {
  if (value === "fixed") return "Se paga siempre";
  if (value === "if_service") return "Solo si trabaja ese dia";
  return "No pagar sueldo";
}

function optionLabel(option: string) {
  if (["none", "fixed", "if_service"].includes(option)) return salaryModeLabel(option as SalaryMode);
  return option.includes("|") ? option.split("|")[1] : option || "Sin seleccionar";
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard");
  const [weekDate, setWeekDate] = useState(toDateInput(new Date()));
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientModalId, setClientModalId] = useState("");
  const [showClientCreateModal, setShowClientCreateModal] = useState(false);
  const [showExpenseCreateModal, setShowExpenseCreateModal] = useState(false);
  const [showPayrollDeductionModal, setShowPayrollDeductionModal] = useState(false);
  const [showEmployeeCreateModal, setShowEmployeeCreateModal] = useState(false);
  const [employeeEditId, setEmployeeEditId] = useState("");
  const [calendarModalDay, setCalendarModalDay] = useState("");
  const [closeClientId, setCloseClientId] = useState("");
  const [closeAppointmentId, setCloseAppointmentId] = useState("");
  const [closePaymentMethod, setClosePaymentMethod] = useState("Transferencia");
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(toDateInput(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payrollDeductions, setPayrollDeductions] = useState<PayrollDeduction[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const weekStart = startOfWeek(new Date(`${weekDate}T00:00:00`));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const weekLastDay = new Date(weekEnd);
  weekLastDay.setDate(weekEnd.getDate() - 1);

  const loadData = useCallback(async (nextProfile: Profile | null) => {
    if (!supabase) return;
    setLoading(true);
    const canManageAppointmentsUser = nextProfile?.role === "admin" || nextProfile?.role === "business";
    const isAdminUser = nextProfile?.role === "admin";
    const [{ data: clientData }, { data: appointmentData }, serviceResponse, expenseResponse, deductionResponse, employeeResponse] = await Promise.all([
      supabase.from("clients").select("*").order("full_name"),
      supabase.from("appointments").select("*").order("appointment_at"),
      canManageAppointmentsUser ? supabase.from("service_records").select("*").order("service_date", { ascending: false }) : Promise.resolve({ data: [] }),
      isAdminUser ? supabase.from("expenses").select("*").order("expense_date", { ascending: false }) : Promise.resolve({ data: [] }),
      isAdminUser ? supabase.from("payroll_deductions").select("*").order("deduction_date", { ascending: false }) : Promise.resolve({ data: [] }),
      canManageAppointmentsUser ? supabase.from("employees").select("*").order("is_active", { ascending: false }).order("full_name") : Promise.resolve({ data: [] }),
    ]);
    setClients((clientData ?? []) as Client[]);
    setAppointments((appointmentData ?? []) as Appointment[]);
    setRecords((serviceResponse.data ?? []) as ServiceRecord[]);
    setExpenses((expenseResponse.data ?? []) as Expense[]);
    setPayrollDeductions((deductionResponse.data ?? []) as PayrollDeduction[]);
    setEmployees((employeeResponse.data ?? []) as Employee[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!supabase || !session?.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      const nextProfile = (data as Profile) ?? null;
      setProfile(nextProfile);
      await loadData(nextProfile);
    }

    loadProfile();
  }, [loadData, session]);

  async function signIn() {
    if (!supabase || !email || !password) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : "Entrando...");
  }

  async function createClient(formData: FormData) {
    if (!supabase) return;
    const payload = {
      full_name: String(formData.get("full_name") || "").trim(),
      phone: String(formData.get("phone") || "").trim() || null,
      instagram: String(formData.get("instagram") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      created_by: session?.user.id,
    };
    if (!payload.full_name) {
      setMessage("Escribe el nombre de la clienta.");
      return;
    }
    const { error } = await supabase.from("clients").insert(payload);
    setMessage(error ? error.message : "Clienta guardada.");
    if (!error) setShowClientCreateModal(false);
    await loadData(profile);
  }

  async function createAppointment(formData: FormData) {
    if (!supabase) return;
    const clientValue = String(formData.get("client_id") || "");
    const selectedClientId = clientValue ? clientValue.split("|")[0] : null;
    const clientName = selectedClientId ? clients.find((client) => client.id === selectedClientId)?.full_name ?? "" : "";

    if (!clientName) {
      setMessage("Primero registra la clienta en Nueva clienta y despues agenda su cita.");
      return;
    }

    const payload = {
      client_id: selectedClientId,
      client_name: clientName,
      requested_service: String(formData.get("requested_service")),
      provider: String(formData.get("provider")),
      appointment_at: String(formData.get("appointment_at")),
      contact_channel: String(formData.get("contact_channel")),
      created_by: session?.user.id,
    };
    const { error } = await supabase.from("appointments").insert(payload);
    setMessage(error ? error.message : "Cita guardada.");
    await loadData(profile);
  }

  async function updateClient(formData: FormData) {
    if (!supabase || !selectedClientStats) return;
    const payload = {
      full_name: String(formData.get("full_name") || "").trim(),
      phone: String(formData.get("phone") || "").trim() || null,
      instagram: String(formData.get("instagram") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
    };
    if (!payload.full_name) {
      setMessage("La clienta debe tener nombre.");
      return;
    }
    const { error } = await supabase.from("clients").update(payload).eq("id", selectedClientStats.client.id);
    if (!error) {
      await supabase.from("appointments").update({ client_name: payload.full_name }).eq("client_id", selectedClientStats.client.id);
    }
    setMessage(error ? error.message : "Clienta actualizada.");
    await loadData(profile);
  }

  async function closeService(formData: FormData) {
    if (!supabase) return;
    const cost = Number(formData.get("cost") || 0);
    const paymentMethod = String(formData.get("payment_method"));
    const cashAmount = paymentMethod === "Efectivo" ? cost : paymentMethod === "Mixto" ? Number(formData.get("cash_amount") || 0) : 0;
    const transferAmount = paymentMethod === "Transferencia" ? cost : paymentMethod === "Mixto" ? Number(formData.get("transfer_amount") || 0) : 0;
    const cardAmount = paymentMethod === "Tarjeta" ? cost : paymentMethod === "Mixto" ? Number(formData.get("card_amount") || 0) : 0;
    const appointmentValue = String(formData.get("appointment_id") || "");
    const appointmentId = appointmentValue ? appointmentValue.split("|")[0] : null;
    const selectedAppointment = appointmentId ? appointments.find((appointment) => appointment.id === appointmentId) : null;
    if (!selectedAppointment) {
      setMessage("Selecciona una cita pendiente para cerrar el servicio.");
      return;
    }
    const payload = {
      appointment_id: appointmentId,
      client_id: selectedAppointment.client_id,
      service_name: String(formData.get("service_name")),
      provider: String(formData.get("provider")),
      service_date: String(formData.get("service_date")),
      cost,
      payment_method: paymentMethod,
      cash_amount: cashAmount,
      transfer_amount: transferAmount,
      card_amount: cardAmount,
      tip_amount: Number(formData.get("tip_amount") || 0),
      tip_payment_method: formData.get("tip_payment_method") || null,
      notes: String(formData.get("notes") || ""),
      created_by: session?.user.id,
    };
    const { error } = await supabase.from("service_records").insert(payload);
    setMessage(error ? error.message : `Servicio cerrado. Total cobrado: ${money(cost)}.`);
    if (!error) setCloseAppointmentId("");
    await loadData(profile);
  }

  async function createExpense(formData: FormData) {
    if (!supabase) return;
    const payload = {
      concept: String(formData.get("concept")),
      expense_date: String(formData.get("expense_date")),
      amount: Number(formData.get("amount") || 0),
      payment_method: String(formData.get("payment_method")),
      category: String(formData.get("category")),
      created_by: session?.user.id,
    };
    const { error } = await supabase.from("expenses").insert(payload);
    setMessage(error ? error.message : "Gasto guardado.");
    if (!error) setShowExpenseCreateModal(false);
    await loadData(profile);
  }

  async function createPayrollDeduction(formData: FormData) {
    if (!supabase) return;
    const employeeValue = String(formData.get("employee_id") || "");
    const employeeId = employeeValue ? employeeValue.split("|")[0] : null;
    const employeeName = employeeValue ? employeeValue.split("|")[1] : "";
    const payload = {
      employee_id: employeeId,
      employee_name: employeeName,
      deduction_date: String(formData.get("deduction_date")),
      amount: Number(formData.get("amount") || 0),
      reason: String(formData.get("reason") || "").trim(),
      created_by: session?.user.id,
    };
    if (!payload.employee_id || !payload.amount || !payload.reason) {
      setMessage("Selecciona empleada, monto y razon del descuento.");
      return;
    }
    const { error } = await supabase.from("payroll_deductions").insert(payload);
    setMessage(error ? error.message : "Descuento a nomina guardado.");
    if (!error) setShowPayrollDeductionModal(false);
    await loadData(profile);
  }

  async function createEmployee(formData: FormData) {
    if (!supabase) return;
    const employeeData = employeePayload(formData);
    const payload = {
      ...employeeData,
      created_by: session?.user.id,
    };
    if (!String(employeeData.full_name || "") || !String(employeeData.email || "")) {
      setMessage("Escribe nombre completo y correo del empleado.");
      return;
    }
    const { error } = await supabase.from("employees").insert(payload);
    setMessage(error ? error.message : "Empleado guardado.");
    if (!error) setShowEmployeeCreateModal(false);
    await loadData(profile);
  }

  async function updateEmployee(formData: FormData) {
    if (!supabase || !employeeEditId) return;
    const payload = employeePayload(formData);
    if (!String(payload.full_name || "") || !String(payload.email || "")) {
      setMessage("Escribe nombre completo y correo del empleado.");
      return;
    }
    const { error } = await supabase.from("employees").update(payload).eq("id", employeeEditId);
    setMessage(error ? error.message : "Empleado actualizado.");
    setEmployeeEditId("");
    await loadData(profile);
  }

  async function setEmployeeActive(id: string, isActive: boolean) {
    if (!supabase) return;
    const { error } = await supabase.from("employees").update({ is_active: isActive }).eq("id", id);
    setMessage(error ? error.message : isActive ? "Empleado reactivado." : "Empleado inactivado.");
    await loadData(profile);
  }

  async function cancelAppointment(id: string) {
    if (!supabase || !isAdmin) return;
    const { error } = await supabase.from("appointments").update({ canceled: true }).eq("id", id);
    setMessage(error ? error.message : "Cita cancelada.");
    await loadData(profile);
  }

  function exportBackup(format: "json" | "csv") {
    const stamp = new Date().toISOString().slice(0, 10);
    const backup = { exported_at: new Date().toISOString(), clients, appointments, service_records: records, expenses, payroll_deductions: payrollDeductions, employees };

    if (format === "json") {
      download(`luma-respaldo-${stamp}.json`, JSON.stringify(backup, null, 2), "application/json");
      return;
    }

    download(`luma-clientas-${stamp}.csv`, toCsv(clients), "text/csv;charset=utf-8");
    download(`luma-citas-${stamp}.csv`, toCsv(appointments), "text/csv;charset=utf-8");
    download(`luma-servicios-${stamp}.csv`, toCsv(records), "text/csv;charset=utf-8");
    download(`luma-gastos-${stamp}.csv`, toCsv(expenses), "text/csv;charset=utf-8");
    download(`luma-descuentos-nomina-${stamp}.csv`, toCsv(payrollDeductions), "text/csv;charset=utf-8");
    download(`luma-empleados-${stamp}.csv`, toCsv(employees), "text/csv;charset=utf-8");
  }

  const weeklyRecords = records.filter((record) => {
    const date = new Date(`${record.service_date}T00:00:00`);
    return date >= weekStart && date < weekEnd;
  });
  const weeklyExpenses = expenses.filter((expense) => {
    const date = new Date(`${expense.expense_date}T00:00:00`);
    return date >= weekStart && date < weekEnd;
  });
  const weeklyPayrollDeductions = payrollDeductions.filter((deduction) => {
    const date = new Date(`${deduction.deduction_date}T00:00:00`);
    return date >= weekStart && date < weekEnd;
  });
  const totalSold = weeklyRecords.reduce((sum, record) => sum + Number(record.cost), 0);
  const totalExpenses = weeklyExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const activeEmployees = employees.filter((employee) => employee.is_active);
  const inactiveEmployees = employees.filter((employee) => !employee.is_active);
  const providerOptions = activeEmployees.length ? activeEmployees.map((employee) => employee.full_name) : [...providers];
  const dashboardEmployees = activeEmployees.length
    ? activeEmployees
    : providers.map((provider) => ({ id: provider, full_name: provider, salary: 0, commission_rate: 0.3, deduct_card_fee: true, phone: null, email: "", is_active: true } as Employee));
  const providerStats = dashboardEmployees.map((employee) => {
    const providerRecords = weeklyRecords.filter((record) => record.provider === employee.full_name);
    const sales = providerRecords.reduce((sum, record) => sum + Number(record.cost), 0);
    const tips = providerRecords.reduce((sum, record) => sum + Number(record.tip_amount), 0);
    const cardFees = employee.deduct_card_fee ? providerRecords.reduce((sum, record) => sum + Number(record.card_amount || 0) * cardFeeRate, 0) : 0;
    const payrollDiscounts = weeklyPayrollDeductions.filter((deduction) => deduction.employee_id === employee.id || deduction.employee_name === employee.full_name).reduce((sum, deduction) => sum + Number(deduction.amount), 0);
    const commission = providerRecords.reduce((sum, record) => {
      const dayKey = dayKeyFromDate(record.service_date);
      return sum + Number(record.cost) * employeeNumber(employee, `${dayKey}_commission_rate`);
    }, 0);
    const salary = weekDays.reduce((sum, day) => {
      const mode = employeeSalaryMode(employee, `${day.key}_salary_mode`);
      const daySalary = employeeNumber(employee, `${day.key}_salary`);
      const hasService = providerRecords.some((record) => dayKeyFromDate(record.service_date) === day.key);
      if (mode === "fixed" || (mode === "if_service" && hasService)) return sum + daySalary;
      return sum;
    }, 0);
    return { provider: employee.full_name, sales, tips, cardFees, payrollDiscounts, commission, salary, totalPay: salary + commission + tips - cardFees - payrollDiscounts };
  });
  const totalProviderPay = providerStats.reduce((sum, item) => sum + item.totalPay, 0);
  const available = totalSold - totalProviderPay - totalExpenses;
  const clientStats = clients
    .map((client) => {
      const clientRecords = records.filter((record) => record.client_id === client.id);
      const clientAppointments = appointments.filter((appointment) => appointment.client_id === client.id);
      const totalSpent = clientRecords.reduce((sum, record) => sum + Number(record.cost), 0);
      const lastVisit = clientRecords[0]?.service_date ?? clientAppointments[clientAppointments.length - 1]?.appointment_at?.slice(0, 10) ?? "Sin visitas";
      return { client, appointments: clientAppointments.length, services: clientRecords.length, totalSpent, lastVisit };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent || b.services - a.services);
  const selectedClientStats = clientStats.find((item) => item.client.id === selectedClientId) ?? clientStats[0];
  const modalClientStats = clientStats.find((item) => item.client.id === clientModalId) ?? null;
  const modalClientRecords = modalClientStats ? records.filter((record) => record.client_id === modalClientStats.client.id) : [];
  const modalClientAppointments = modalClientStats ? appointments.filter((appointment) => appointment.client_id === modalClientStats.client.id) : [];
  const filteredClientStats = clientStats.filter(({ client }) => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) return true;
    return [client.full_name, client.phone, client.instagram].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
  });
  const expensesByCategory = ["Insumos", "Limpieza", "Renta", "Otros"].map((category) => ({
    category,
    total: weeklyExpenses.filter((expense) => expense.category === category).reduce((sum, expense) => sum + Number(expense.amount), 0),
  }));
  const expensesByPayment = ["Efectivo de caja", "Transferencia"].map((method) => ({
    method,
    total: weeklyExpenses.filter((expense) => expense.payment_method === method).reduce((sum, expense) => sum + Number(expense.amount), 0),
  }));
  const monthStart = new Date(`${selectedCalendarDay}T00:00:00`);
  monthStart.setDate(1);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthStart.getMonth() + 1);
  const calendarAppointments = appointments.filter((appointment) => {
    const date = new Date(appointment.appointment_at);
    return date >= monthStart && date < monthEnd;
  });
  const closedAppointmentIds = new Set(records.map((record) => record.appointment_id).filter(Boolean));
  const pendingCloseAppointments = appointments.filter((appointment) => !appointment.canceled && !appointment.no_show && !closedAppointmentIds.has(appointment.id));
  const closeClientAppointments = pendingCloseAppointments.filter((appointment) => appointment.client_id === closeClientId);
  const closeClientOptionValue = closeClientId ? `${closeClientId}|${clients.find((client) => client.id === closeClientId)?.full_name ?? ""}` : "";
  const closeAppointment = closeClientAppointments.find((appointment) => appointment.id === closeAppointmentId);
  const closeAppointmentOptionValue = closeAppointment ? `${closeAppointment.id}|${new Date(closeAppointment.appointment_at).toLocaleString("es-MX")} - ${closeAppointment.requested_service}` : "";
  const monthOffset = (monthStart.getDay() + 6) % 7;
  const monthDaysCount = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: monthOffset + monthDaysCount }, (_, index) => {
    if (index < monthOffset) return null;
    const date = new Date(monthStart);
    date.setDate(index - monthOffset + 1);
    const key = toDateInput(date);
    return { key, label: String(date.getDate()), appointments: calendarAppointments.filter((appointment) => appointment.appointment_at.slice(0, 10) === key) };
  });
  const visibleCalendarDay = calendarDays.find((day) => day?.key === calendarModalDay) ?? null;
  const isAdmin = profile?.role === "admin";
  const canManageAppointments = profile?.role === "admin" || profile?.role === "business";

  if (!isSupabaseConfigured) {
    return (
      <main className={appShell}>
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-white/40 bg-[#ffffff]/88 p-8 shadow-2xl shadow-[#4c5638]/10 backdrop-blur">
          <BrandMark />
          <p className="mt-8 text-xs font-semibold uppercase text-[#8a966d] brand-condensed">LUMA</p>
          <h1 className="mt-3 text-4xl font-semibold text-[#4c5638] brand-serif">Configura Supabase para empezar</h1>
          <p className="mt-4 text-[#5d4743]">Copia `.env.example` a `.env.local`, pega `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, y ejecuta el SQL de `supabase/schema.sql` en Supabase.</p>
          <div className="mt-6 rounded-2xl bg-[#4c5638] p-4 font-mono text-sm text-white">npm run dev</div>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className={`${appShell} grid place-items-center`}>
        <section className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/35 bg-[#ffffff]/90 shadow-2xl shadow-[#4c5638]/15 backdrop-blur">
          <div className="bg-[#4c5638] px-8 py-10 text-center">
            <BrandMark centered />
            <p className="mt-6 text-xs font-semibold uppercase text-[#d9dbbc] brand-condensed">LUMA</p>
            <h1 className="mt-3 text-4xl font-semibold text-white brand-serif">Administracion</h1>
          </div>
          <div className="p-8">
            <input className="mt-2 w-full rounded-2xl border border-[#cac5a7] bg-white/70 px-4 py-3 outline-none transition placeholder:text-[#8a966d] focus:border-[#8a966d]" placeholder="correo del equipo LUMA" value={email} onChange={(event) => setEmail(event.target.value)} />
            <input className="mt-3 w-full rounded-2xl border border-[#cac5a7] bg-white/70 px-4 py-3 outline-none transition placeholder:text-[#8a966d] focus:border-[#8a966d]" placeholder="contrasena" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <button className={`${primaryButton} mt-5 w-full`} onClick={signIn}>Entrar</button>
            {message && <p className="mt-4 text-sm text-[#4c5638]">{message}</p>}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={appShell}>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="relative overflow-hidden rounded-[2.25rem] bg-[#4c5638] p-6 text-white shadow-2xl shadow-[#4c5638]/20 md:p-8">
          <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#8a966d] opacity-70" />
          <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="flex items-center gap-5">
              <BrandMark />
              <div>
                <p className="text-xs font-semibold uppercase text-[#d9dbbc] brand-condensed">LUMA</p>
                <h1 className="mt-2 text-4xl font-semibold md:text-6xl brand-serif">{isAdmin ? "Administracion por modulos" : "Agenda de citas"}</h1>
                <p className="mt-2 text-[#d9dbbc]">{profile?.full_name ?? session.user.email} · {profile?.role === "admin" ? "Acceso completo" : "Negocio"}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {isAdmin && <button className="rounded-full bg-[#d9dbbc] px-5 py-3 text-sm font-semibold text-[#26301d] transition hover:bg-white" onClick={() => exportBackup("json")}>Respaldo JSON</button>}
              {isAdmin && <button className={secondaryButton} onClick={() => exportBackup("csv")}>Exportar CSV</button>}
              <button className={secondaryButton} onClick={() => supabase?.auth.signOut()}>Salir</button>
            </div>
          </div>
        </header>

        {message && <div className="rounded-2xl border border-[#8a966d]/30 bg-white/90 p-4 text-sm text-[#4c5638] shadow-sm">{message}</div>}

        <nav className="grid gap-2 rounded-[2rem] border border-white/60 bg-white/55 p-2 shadow-xl shadow-[#4c5638]/5 backdrop-blur md:grid-cols-6">
          {modules.map((module) => {
            const active = activeModule === module.id;
            const disabled = !isAdmin && !["clients", "appointments", "calendar"].includes(module.id);
            return (
              <button
                className={`rounded-full px-4 py-3 text-sm font-semibold transition ${active ? "bg-[#4c5638] text-white shadow-lg shadow-[#4c5638]/15" : "bg-white/50 text-[#4c5638] hover:bg-white"} ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                disabled={disabled}
                key={module.id}
                onClick={() => setActiveModule(module.id)}
                type="button"
              >
                {module.label}
              </button>
            );
          })}
        </nav>

        {isAdmin && activeModule === "dashboard" && <section className="grid gap-4 md:grid-cols-5">
          <Metric title="Total vendido" value={money(totalSold)} />
          <Metric title="Clientas" value={String(clients.length)} />
          <Metric title="Gastos LUMA" value={money(totalExpenses)} />
          <Metric title="Pago equipo" value={money(totalProviderPay)} />
          <Metric title="Saldo disponible" value={money(available)} tone={available >= 0 ? "good" : "bad"} />
        </section>}

        {isAdmin && ["expenses", "employees"].includes(activeModule) && <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">

          {activeModule === "expenses" && <Card title="Modulo de gastos">
            <div className="space-y-4">
              <div className="rounded-3xl bg-[#8a966d] p-5 text-[#ffffff]">
                <p className="text-xs uppercase text-[#cac5a7] brand-condensed">Semana seleccionada</p>
                <p className="mt-2 text-4xl font-semibold brand-serif">{money(totalExpenses)}</p>
                <p className="mt-1 text-sm text-[#cac5a7]">{weeklyExpenses.length} gastos capturados</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {expensesByCategory.map(({ category, total }) => <Summary key={category} label={category} value={money(total)} />)}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {expensesByPayment.map(({ method, total }) => <Summary key={method} label={method} value={money(total)} />)}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button className={primaryButton} onClick={() => setShowExpenseCreateModal(true)} type="button">Agregar gasto</button>
                <button className="rounded-full border border-[#4c5638]/20 bg-white/70 px-5 py-3 text-sm font-semibold text-[#4c5638] transition hover:bg-white" onClick={() => setShowPayrollDeductionModal(true)} type="button">Agregar descuento a nomina</button>
              </div>

              <div className="space-y-2">
                {weeklyExpenses.slice(0, 5).map((expense) => (
                  <div className="flex items-center justify-between rounded-2xl border border-[#cac5a7] bg-white/50 p-3 text-sm" key={expense.id}>
                    <span>{expense.concept}</span>
                    <span className="font-semibold text-[#4c5638]">{money(Number(expense.amount))}</span>
                  </div>
                ))}
                {!weeklyExpenses.length && <p className="text-sm text-[#7a625c]">No hay gastos en esta semana.</p>}
              </div>
              {!!weeklyPayrollDeductions.length && <div className="rounded-2xl border border-[#cac5a7] bg-white/45 p-4">
                <p className="text-sm font-semibold text-[#4c5638]">Descuentos a nomina de la semana</p>
                <div className="mt-3 space-y-2">
                  {weeklyPayrollDeductions.map((deduction) => <div className="rounded-2xl bg-white/60 p-3 text-sm" key={deduction.id}><div className="flex items-center justify-between gap-3"><span className="font-semibold text-[#4c5638]">{deduction.employee_name}</span><span>{money(Number(deduction.amount))}</span></div><p className="mt-1 text-[#7a625c]">{deduction.deduction_date} · {deduction.reason}</p></div>)}
                </div>
              </div>}
            </div>
          </Card>}

          {activeModule === "employees" && <Card title="Modulo de empleados">
            <div className="space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#4c5638]">Empleados activos</p>
                  <p className="text-sm text-[#7a625c]">Estos aparecen en agenda, calendario y pagos.</p>
                </div>
                <button className={primaryButton} onClick={() => setShowEmployeeCreateModal(true)} type="button">Agregar empleado</button>
              </div>
              {activeEmployees.map((employee) => (
                <div className="flex flex-col gap-3 rounded-2xl border border-[#cac5a7] bg-white/50 p-4 md:flex-row md:items-center md:justify-between" key={employee.id}>
                  <div>
                    <p className="font-semibold text-[#4c5638]">{employee.full_name}</p>
                    <p className="text-sm text-[#7a625c]">{[employee.phone, employee.email].filter(Boolean).join(" · ")}</p>
                    <p className="mt-1 text-sm text-[#7a625c]">Pago configurable por dia · Tarjeta {employee.deduct_card_fee ? "descuenta 4.18%" : "sin descuento"}</p>
                    <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Activo</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-full border border-[#cac5a7] bg-white/60 px-4 py-2 text-sm font-semibold text-[#4c5638] transition hover:bg-white" onClick={() => setEmployeeEditId(employee.id)} type="button">Editar</button>
                    <button className="rounded-full border border-[#cac5a7] bg-white/60 px-4 py-2 text-sm font-semibold text-[#4c5638] transition hover:bg-white" onClick={() => setEmployeeActive(employee.id, !employee.is_active)} type="button">
                      {employee.is_active ? "Inactivar" : "Reactivar"}
                    </button>
                  </div>
                </div>
              ))}
              {!activeEmployees.length && <p className="text-sm text-[#7a625c]">No hay empleados activos.</p>}
              {!!inactiveEmployees.length && <div className="rounded-2xl border border-[#cac5a7] bg-white/35 p-4">
                <p className="mb-3 text-sm font-semibold text-[#4c5638]">Inactivos</p>
                <div className="space-y-2">
                  {inactiveEmployees.map((employee) => <div className="flex flex-col gap-2 rounded-2xl bg-white/55 p-3 md:flex-row md:items-center md:justify-between" key={employee.id}><span className="text-sm text-[#7a625c]">{employee.full_name} · {employee.email}</span><button className="rounded-full border border-[#cac5a7] bg-white/60 px-4 py-2 text-sm font-semibold text-[#4c5638]" onClick={() => setEmployeeActive(employee.id, true)} type="button">Reactivar</button></div>)}
                </div>
              </div>}
            </div>
          </Card>}
        </section>}

        {isAdmin && activeModule === "dashboard" && <section className="rounded-[2rem] border border-white/45 bg-[#ffffff]/88 p-5 shadow-xl shadow-[#4c5638]/5 backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Panel del sabado</h2>
              <p className="text-sm text-stone-500">Selecciona el sabado, o cualquier dia de esa semana. Se calcula de lunes a domingo.</p>
              <p className="mt-1 text-sm font-semibold text-[#8a966d]">Semana: {displayDate(weekStart)} al {displayDate(weekLastDay)}</p>
            </div>
            <input className="rounded-xl border border-stone-300 px-4 py-2" type="date" value={weekDate} onChange={(event) => setWeekDate(event.target.value)} />
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            {providerStats.map((item, index) => (
              <PayColumn
                accent={index === 0 ? "dark" : undefined}
                commission={money(item.commission)}
                key={item.provider}
                name={item.provider}
                sales={money(item.sales)}
                salary={money(item.salary)}
                tips={money(item.tips)}
                total={money(item.totalPay)}
                cardFees={money(item.cardFees)}
                payrollDiscounts={money(item.payrollDiscounts)}
              />
            ))}
            <div className="rounded-[1.75rem] border border-[#cac5a7] bg-white/55 p-5 shadow-lg shadow-[#4c5638]/5">
              <p className="text-xs font-semibold uppercase text-[#8a966d] brand-condensed">Resumen negocio</p>
              <p className="mt-2 text-3xl font-semibold text-[#4c5638] brand-serif">{money(totalSold)}</p>
              <p className="text-sm text-[#7a625c]">Ventas totales de la semana</p>
              <div className="mt-5 space-y-3">
                {providerStats.map((item) => <SummaryLine key={item.provider} label={`Pago ${item.provider.split(" ")[0]}`} value={`-${money(item.totalPay)}`} />)}
                <SummaryLine label="Gastos LUMA" value={`-${money(totalExpenses)}`} />
                <SummaryLine label="Descuentos nomina" value={`-${money(weeklyPayrollDeductions.reduce((sum, item) => sum + Number(item.amount), 0))}`} />
              </div>
              <div className={`mt-5 rounded-2xl p-4 ${available >= 0 ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}>
                <p className="text-sm font-semibold">Utilidad de la semana</p>
                <p className="mt-1 text-3xl font-semibold brand-serif">{money(available)}</p>
              </div>
            </div>
          </div>
        </section>}

        {["appointments", "expenses", "employees"].includes(activeModule) && <section className={`grid gap-6 ${activeModule === "appointments" || activeModule === "expenses" ? "xl:grid-cols-2" : "xl:grid-cols-4"}`}>
          {canManageAppointments && activeModule === "appointments" && <Card title="Nueva cita">
            <Form action={createAppointment}>
              <Select name="client_id" label="Clienta" options={["", ...clients.map((client) => `${client.id}|${client.full_name}`)]} required />
              <Select name="requested_service" label="Servicio" options={services} />
              <Select name="provider" label="Prestadora" options={providerOptions} />
              <Input name="appointment_at" label="Fecha y hora" type="datetime-local" required />
              <Select name="contact_channel" label="Canal" options={["WhatsApp", "Instagram"]} />
              <Submit>Guardar cita</Submit>
            </Form>
          </Card>}

          {canManageAppointments && activeModule === "appointments" && <Card title="Cerrar servicio">
            <Form action={closeService}>
              <Select name="client_id" label="Clienta" options={["", ...clients.map((client) => `${client.id}|${client.full_name}`)]} value={closeClientOptionValue} onChange={(event) => { setCloseClientId(event.target.value.split("|")[0]); setCloseAppointmentId(""); }} required />
              <Select name="appointment_id" label="Cita pendiente de cierre" options={["", ...closeClientAppointments.map((item) => `${item.id}|${new Date(item.appointment_at).toLocaleString("es-MX")} - ${item.requested_service}`)]} value={closeAppointmentOptionValue} onChange={(event) => setCloseAppointmentId(event.target.value.split("|")[0])} required />
              {closeClientId && !closeClientAppointments.length && <p className="rounded-2xl bg-white/45 p-3 text-sm text-[#7a625c]">Esta clienta no tiene citas pendientes. Primero crea la cita y despues cierra el servicio.</p>}
              <Input name="service_name" label="Servicio realizado" required />
              <Select name="provider" label="Prestadora" options={providerOptions} />
              <Input name="service_date" label="Fecha" type="date" defaultValue={toDateInput(new Date())} required />
              <Input name="cost" label="Costo" type="number" required />
              <Select name="payment_method" label="Forma de pago" options={["Transferencia", "Efectivo", "Tarjeta", "Mixto"]} value={closePaymentMethod} onChange={(event) => setClosePaymentMethod(event.target.value)} />
              {closePaymentMethod === "Mixto" && <div className="grid gap-3 rounded-2xl border border-[#cac5a7] bg-white/45 p-3 sm:grid-cols-3">
                <label className="grid gap-1 text-sm font-medium text-[#5d4743]"><span><input className="mr-2" type="checkbox" />Efectivo</span><input className="rounded-2xl border border-[#cac5a7] bg-white/60 px-3 py-2 text-sm outline-none" name="cash_amount" placeholder="Monto" type="number" /></label>
                <label className="grid gap-1 text-sm font-medium text-[#5d4743]"><span><input className="mr-2" type="checkbox" />Transferencia</span><input className="rounded-2xl border border-[#cac5a7] bg-white/60 px-3 py-2 text-sm outline-none" name="transfer_amount" placeholder="Monto" type="number" /></label>
                <label className="grid gap-1 text-sm font-medium text-[#5d4743]"><span><input className="mr-2" type="checkbox" />Tarjeta</span><input className="rounded-2xl border border-[#cac5a7] bg-white/60 px-3 py-2 text-sm outline-none" name="card_amount" placeholder="Monto" type="number" /></label>
              </div>}
              <Input name="tip_amount" label="Propina" type="number" defaultValue="0" />
              <Select name="tip_payment_method" label="Pago propina" options={["", "Transferencia", "Efectivo"]} />
              <textarea className="min-h-24 rounded-2xl border border-[#cac5a7] bg-white/60 px-3 py-2 text-sm outline-none transition placeholder:text-[#8b7770] focus:border-[#8a966d]" name="notes" placeholder="Observaciones" />
              <Submit>Cerrar servicio</Submit>
            </Form>
          </Card>}

        </section>}

        {activeModule === "clients" && <section className="rounded-[2rem] border border-white/45 bg-[#ffffff]/88 p-5 shadow-xl shadow-[#4c5638]/5 backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[#4c5638] brand-serif">Listado de clientas</h2>
              <p className="text-sm text-[#7a625c]">Busca por nombre, telefono o Instagram y abre la ficha.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {canManageAppointments && <button className={primaryButton} onClick={() => setShowClientCreateModal(true)} type="button">Agregar clienta</button>}
              <input className="rounded-2xl border border-[#cac5a7] bg-white/70 px-4 py-3 text-sm outline-none transition placeholder:text-[#8a966d] focus:border-[#8a966d]" placeholder="Buscar clienta" value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} />
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredClientStats.map(({ client, appointments: appointmentCount, services: serviceCount }) => (
              <button className="rounded-3xl border border-[#cac5a7] bg-white/55 p-4 text-left transition hover:bg-white" key={client.id} onClick={() => { setClientModalId(client.id); setSelectedClientId(client.id); }} type="button">
                <p className="font-semibold text-[#4c5638]">{client.full_name}</p>
                <p className="mt-1 text-sm text-[#7a625c]">{[client.phone, client.instagram].filter(Boolean).join(" · ") || "Sin contacto"}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[#4c5638]">
                  <span className="rounded-full bg-[#d9dbbc] px-3 py-1">{appointmentCount} citas</span>
                  {isAdmin && <span className="rounded-full bg-[#cac5a7] px-3 py-1">{serviceCount} servicios</span>}
                </div>
              </button>
            ))}
            {!filteredClientStats.length && <p className="text-sm text-[#7a625c]">No encontre clientas con ese filtro.</p>}
          </div>
        </section>}

        {["calendar", "expenses"].includes(activeModule) && <section className={activeModule === "calendar" ? "grid gap-6" : "grid gap-6 lg:grid-cols-2"}>
          {activeModule === "calendar" && <Card title="Calendario mensual">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-stone-500">Toca un dia para ver citas, cerrar servicio o cancelar.</p>
                <p className="mt-1 text-sm font-semibold capitalize text-[#8a966d]">{monthStart.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}</p>
              </div>
              <input className="rounded-xl border border-stone-300 px-4 py-2" type="month" value={selectedCalendarDay.slice(0, 7)} onChange={(event) => setSelectedCalendarDay(`${event.target.value}-01`)} />
            </div>
            <div className="space-y-4">
              {loading && <p className="text-sm text-stone-500">Cargando...</p>}
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase text-[#7a625c] brand-condensed">
                {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, index) => {
                  if (!day) return <div className="min-h-20 rounded-2xl bg-white/20" key={`empty-${index}`} />;
                  const activeCount = day.appointments.filter((appointment) => !appointment.canceled).length;
                  return <button className="min-h-20 rounded-2xl border border-[#cac5a7] bg-white/55 p-2 text-left transition hover:bg-white md:min-h-28" key={day.key} onClick={() => setCalendarModalDay(day.key)} type="button"><p className="text-lg font-semibold text-[#4c5638] brand-serif">{day.label}</p><p className="mt-2 text-xs text-[#7a625c]">{activeCount} citas</p></button>;
                })}
              </div>
              {!loading && !calendarAppointments.length && <p className="text-sm text-[#7a625c]">No hay citas en este rango.</p>}
            </div>
          </Card>}

          {isAdmin && activeModule === "expenses" && <Card title="Ultimos gastos">
            <div className="space-y-3">
              {expenses.slice(0, 10).map((expense) => (
                <div className="flex items-center justify-between rounded-2xl border border-[#cac5a7] bg-white/50 p-4" key={expense.id}>
                  <div>
                    <p className="font-semibold">{expense.concept}</p>
                    <p className="text-sm text-stone-500">{expense.expense_date} · {expense.category} · {expense.payment_method}</p>
                  </div>
                  <p className="font-semibold">{money(Number(expense.amount))}</p>
                </div>
              ))}
            </div>
          </Card>}
        </section>}

        {isAdmin && showEmployeeCreateModal && <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 p-3 md:place-items-center" onClick={() => setShowEmployeeCreateModal(false)}> 
          <section className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[2rem] bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[#8a966d] brand-condensed">Empleado</p>
                <h2 className="mt-1 text-3xl font-semibold text-[#4c5638] brand-serif">Agregar empleado</h2>
              </div>
              <button className="rounded-full bg-[#d9dbbc] px-4 py-2 text-sm font-semibold text-[#4c5638]" onClick={() => setShowEmployeeCreateModal(false)} type="button">Cerrar</button>
            </div>
            <Form action={createEmployee}><EmployeeFields /><Submit>Guardar empleado</Submit></Form>
          </section>
        </div>}

        {canManageAppointments && showClientCreateModal && <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 p-3 md:place-items-center" onClick={() => setShowClientCreateModal(false)}> 
          <section className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-[2rem] bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[#8a966d] brand-condensed">Clienta</p>
                <h2 className="mt-1 text-3xl font-semibold text-[#4c5638] brand-serif">Agregar clienta</h2>
              </div>
              <button className="rounded-full bg-[#d9dbbc] px-4 py-2 text-sm font-semibold text-[#4c5638]" onClick={() => setShowClientCreateModal(false)} type="button">Cerrar</button>
            </div>
            <Form action={createClient}>
              <Input name="full_name" label="Nombre" required />
              <Input name="phone" label="Telefono" />
              <Input name="instagram" label="Instagram" placeholder="@usuario" />
              <textarea className="min-h-24 rounded-2xl border border-[#cac5a7] bg-white/60 px-3 py-2 text-sm outline-none transition placeholder:text-[#8b7770] focus:border-[#8a966d]" name="notes" placeholder="Notas de la clienta" />
              <Submit>Guardar clienta</Submit>
            </Form>
          </section>
        </div>}

        {isAdmin && showExpenseCreateModal && <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 p-3 md:place-items-center" onClick={() => setShowExpenseCreateModal(false)}> 
          <section className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-[2rem] bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[#8a966d] brand-condensed">Gasto</p>
                <h2 className="mt-1 text-3xl font-semibold text-[#4c5638] brand-serif">Gasto de LUMA</h2>
              </div>
              <button className="rounded-full bg-[#d9dbbc] px-4 py-2 text-sm font-semibold text-[#4c5638]" onClick={() => setShowExpenseCreateModal(false)} type="button">Cerrar</button>
            </div>
            <Form action={createExpense}>
              <Input name="concept" label="Concepto" required />
              <Input name="expense_date" label="Fecha" type="date" defaultValue={toDateInput(new Date())} required />
              <Input name="amount" label="Monto" type="number" required />
              <Select name="payment_method" label="Forma de pago" options={["Efectivo de caja", "Transferencia"]} />
              <Select name="category" label="Categoria" options={["Insumos", "Limpieza", "Renta", "Otros"]} />
              <Submit>Guardar gasto</Submit>
            </Form>
          </section>
        </div>}

        {isAdmin && showPayrollDeductionModal && <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 p-3 md:place-items-center" onClick={() => setShowPayrollDeductionModal(false)}> 
          <section className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-[2rem] bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[#8a966d] brand-condensed">Nomina</p>
                <h2 className="mt-1 text-3xl font-semibold text-[#4c5638] brand-serif">Descuento a nomina</h2>
              </div>
              <button className="rounded-full bg-[#d9dbbc] px-4 py-2 text-sm font-semibold text-[#4c5638]" onClick={() => setShowPayrollDeductionModal(false)} type="button">Cerrar</button>
            </div>
            <Form action={createPayrollDeduction}>
              <Select name="employee_id" label="Empleada" options={["", ...employees.map((employee) => `${employee.id}|${employee.full_name}`)]} required />
              <Input name="deduction_date" label="Fecha" type="date" defaultValue={toDateInput(new Date())} required />
              <Input name="amount" label="Monto" type="number" required />
              <textarea className="min-h-24 rounded-2xl border border-[#cac5a7] bg-white/60 px-3 py-2 text-sm outline-none transition placeholder:text-[#8b7770] focus:border-[#8a966d]" name="reason" placeholder="Razon: reposicion de servicio, adelanto, etc." required />
              <Submit>Guardar descuento</Submit>
            </Form>
          </section>
        </div>}

        {isAdmin && employeeEditId && employees.find((employee) => employee.id === employeeEditId) && <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 p-3 md:place-items-center" onClick={() => setEmployeeEditId("")}> 
          <section className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[2rem] bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[#8a966d] brand-condensed">Empleado</p>
                <h2 className="mt-1 text-3xl font-semibold text-[#4c5638] brand-serif">Editar reglas de pago</h2>
              </div>
              <button className="rounded-full bg-[#d9dbbc] px-4 py-2 text-sm font-semibold text-[#4c5638]" onClick={() => setEmployeeEditId("")} type="button">Cerrar</button>
            </div>
            {(() => {
              const employee = employees.find((item) => item.id === employeeEditId)!;
              return <Form action={updateEmployee}><EmployeeFields employee={employee} /><Submit>Actualizar empleado</Submit></Form>;
            })()}
          </section>
        </div>}

        {modalClientStats && <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 p-3 md:place-items-center" onClick={() => setClientModalId("")}> 
          <section className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-[2rem] bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[#8a966d] brand-condensed">Ficha de clienta</p>
                <h2 className="mt-1 text-3xl font-semibold text-[#4c5638] brand-serif">{modalClientStats.client.full_name}</h2>
                <p className="mt-1 text-sm text-[#7a625c]">{[modalClientStats.client.phone, modalClientStats.client.instagram].filter(Boolean).join(" · ") || "Sin contacto"}</p>
              </div>
              <button className="rounded-full bg-[#d9dbbc] px-4 py-2 text-sm font-semibold text-[#4c5638]" onClick={() => setClientModalId("")} type="button">Cerrar</button>
            </div>
            {modalClientStats.client.notes && <p className="mt-4 rounded-2xl bg-[#d9dbbc]/50 p-3 text-sm text-[#5d4743]">{modalClientStats.client.notes}</p>}
            {isAdmin && <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Summary label="Servicios" value={String(modalClientStats.services)} />
              <Summary label="Total gastado" value={money(modalClientStats.totalSpent)} />
              <Summary label="Ultima visita" value={modalClientStats.lastVisit} />
            </div>}
            {isAdmin && <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#cac5a7] bg-white p-4">
                <p className="mb-3 text-sm font-semibold text-[#4c5638]">Editar datos</p>
                <Form action={updateClient}>
                  <Input name="full_name" label="Nombre" defaultValue={modalClientStats.client.full_name} required />
                  <Input name="phone" label="Telefono" defaultValue={modalClientStats.client.phone ?? ""} />
                  <Input name="instagram" label="Instagram" defaultValue={modalClientStats.client.instagram ?? ""} placeholder="@usuario" />
                  <textarea className="min-h-20 rounded-2xl border border-[#cac5a7] bg-white/60 px-3 py-2 text-sm outline-none transition placeholder:text-[#8b7770] focus:border-[#8a966d]" name="notes" defaultValue={modalClientStats.client.notes ?? ""} placeholder="Notas de la clienta" />
                  <Submit>Actualizar clienta</Submit>
                </Form>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-[#cac5a7] bg-white p-4">
                  <p className="text-sm font-semibold text-[#4c5638]">Historial de servicios</p>
                  <div className="mt-3 space-y-2">
                    {modalClientRecords.slice(0, 8).map((record) => <div className="flex items-center justify-between rounded-2xl bg-[#d9dbbc]/40 px-3 py-2 text-sm" key={record.id}><span>{record.service_date} · {record.service_name}</span><span className="font-semibold">{money(Number(record.cost))}</span></div>)}
                    {!modalClientRecords.length && <p className="text-sm text-[#7a625c]">Sin servicios cerrados.</p>}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#cac5a7] bg-white p-4">
                  <p className="text-sm font-semibold text-[#4c5638]">Citas</p>
                  <div className="mt-3 space-y-2">
                    {modalClientAppointments.slice(0, 8).map((appointment) => <div className="rounded-2xl bg-[#d9dbbc]/40 px-3 py-2 text-sm" key={appointment.id}>{new Date(appointment.appointment_at).toLocaleString("es-MX")} · {appointment.requested_service}</div>)}
                    {!modalClientAppointments.length && <p className="text-sm text-[#7a625c]">Sin citas registradas.</p>}
                  </div>
                </div>
              </div>
            </div>}
          </section>
        </div>}

        {visibleCalendarDay && <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 p-3 md:place-items-center" onClick={() => setCalendarModalDay("")}> 
          <section className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-[2rem] bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[#8a966d] brand-condensed">Detalle del dia</p>
                <h2 className="mt-1 text-3xl font-semibold text-[#4c5638] brand-serif">{new Date(`${visibleCalendarDay.key}T00:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long" })}</h2>
              </div>
              <button className="rounded-full bg-[#d9dbbc] px-4 py-2 text-sm font-semibold text-[#4c5638]" onClick={() => setCalendarModalDay("")} type="button">Cerrar</button>
            </div>
            <div className="mt-5 space-y-3">
              {visibleCalendarDay.appointments.map((appointment) => {
                const isClosed = closedAppointmentIds.has(appointment.id);
                return <div className="rounded-2xl border border-[#cac5a7] bg-white p-4" key={appointment.id}>
                  <p className="text-xs font-semibold uppercase text-[#7a625c] brand-condensed">{new Date(appointment.appointment_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</p>
                  <p className="mt-1 text-lg font-semibold text-[#4c5638]">{appointment.client_name}</p>
                  <p className="text-sm text-[#5d4743]">{appointment.requested_service} · {appointment.provider} · {appointment.contact_channel}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {appointment.canceled && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">Cancelada</span>}
                    {appointment.no_show && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">No asistio</span>}
                    {!appointment.canceled && !appointment.no_show && isClosed && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Servicio cerrado</span>}
                    {!appointment.canceled && !appointment.no_show && !isClosed && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Pendiente de cierre</span>}
                  </div>
                  {!appointment.canceled && !appointment.no_show && !isClosed && <div className="mt-4 flex flex-wrap gap-2">
                    <button className="rounded-full bg-[#4c5638] px-4 py-2 text-sm font-semibold text-white" onClick={() => { setCloseClientId(appointment.client_id ?? ""); setCloseAppointmentId(appointment.id); setActiveModule("appointments"); setCalendarModalDay(""); setMessage("Cita seleccionada. Completa el formulario de Cerrar servicio en Agenda."); }} type="button">Cerrar en Agenda</button>
                    {isAdmin && <button className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700" onClick={() => cancelAppointment(appointment.id)} type="button">Cancelar cita</button>}
                  </div>}
                </div>;
              })}
              {!visibleCalendarDay.appointments.length && <p className="rounded-2xl bg-[#d9dbbc]/40 p-3 text-sm text-[#7a625c]">Sin citas en este dia.</p>}
            </div>
          </section>
        </div>}
      </div>
    </main>
  );
}

function Metric({ title, value, tone }: { title: string; value: string; tone?: "good" | "bad" }) {
  return <div className={`rounded-[1.75rem] border p-5 shadow-xl shadow-[#4c5638]/5 ${tone === "bad" ? "border-[#8a966d]/25 bg-[#8a966d] text-[#ffffff]" : tone === "good" ? "border-[#cac5a7] bg-[#ffffff] text-[#4c5638]" : "border-white/45 bg-white/65 text-[#4c5638]"}`}><p className="text-sm opacity-70">{title}</p><p className="mt-2 text-3xl font-semibold brand-serif">{value}</p></div>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[#cac5a7] bg-white/45 p-4"><p className="text-sm text-[#7a625c]">{label}</p><p className="mt-1 font-semibold text-[#4c5638]">{value}</p></div>;
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/60 px-4 py-3 text-sm"><span className="text-[#7a625c]">{label}</span><span className="font-semibold text-[#4c5638]">{value}</span></div>;
}

function EmployeeFields({ employee }: { employee?: Employee }) {
  return (
    <>
      <Input name="full_name" label="Nombre completo" defaultValue={employee?.full_name ?? ""} required />
      <Input name="phone" label="Telefono de contacto" defaultValue={employee?.phone ?? ""} />
      <Input name="email" label="Correo" type="email" defaultValue={employee?.email ?? ""} required />
      <label className="flex items-center gap-2 rounded-2xl border border-[#cac5a7] bg-white/50 px-3 py-2 text-sm font-medium text-[#5d4743]">
        <input name="deduct_card_fee" type="checkbox" defaultChecked={employee?.deduct_card_fee ?? true} />
        Descontar 4.18% cuando paguen con tarjeta
      </label>
      <div className="rounded-2xl border border-[#cac5a7] bg-white/45 p-3">
        <p className="mb-3 text-sm font-semibold text-[#4c5638]">Reglas por dia</p>
        <div className="grid gap-3">
          {weekDays.map((day) => (
            <div className="grid gap-2 rounded-2xl bg-white/55 p-3 md:grid-cols-[1fr_1fr_1.2fr]" key={day.key}>
              <Input name={`${day.key}_commission_rate`} label={`${day.label} comision (%)`} type="number" defaultValue={employee ? String(employeeNumber(employee, `${day.key}_commission_rate`) * 100) : "0"} />
              <Input name={`${day.key}_salary`} label={`${day.label} sueldo`} type="number" defaultValue={employee ? String(employeeNumber(employee, `${day.key}_salary`)) : "0"} />
              <Select name={`${day.key}_salary_mode`} label="Cuándo pagar sueldo" defaultValue={employee ? employeeSalaryMode(employee, `${day.key}_salary_mode`) : "none"} options={["none", "fixed", "if_service"]} />
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[#7a625c]">Elige si ese dia no lleva sueldo, si se paga siempre o si solo se paga cuando tuvo cita.</p>
      </div>
    </>
  );
}

function PayColumn({ accent, cardFees, commission, name, payrollDiscounts, salary, sales, tips, total }: { accent?: "dark"; cardFees: string; commission: string; name: string; payrollDiscounts: string; salary: string; sales: string; tips: string; total: string }) {
  const dark = accent === "dark";
  return (
    <div className={`rounded-[1.75rem] p-5 shadow-lg shadow-[#4c5638]/5 ${dark ? "bg-[#4c5638] text-[#ffffff]" : "border border-[#cac5a7] bg-[#ffffff] text-[#4c5638]"}`}>
      <p className={`text-xs font-semibold uppercase brand-condensed ${dark ? "text-[#cac5a7]" : "text-[#8a966d]"}`}>Pago semanal</p>
      <h3 className="mt-2 text-4xl font-semibold brand-serif">{name}</h3>
      <div className="mt-5 space-y-3">
        <PayLine dark={dark} label="Ventas" value={sales} />
        <PayLine dark={dark} label="Sueldo" value={salary} />
        <PayLine dark={dark} label="Comisiones" value={commission} />
        <PayLine dark={dark} label="Propinas" value={tips} />
        <PayLine dark={dark} label="Fee tarjeta" value={`-${cardFees}`} />
        <PayLine dark={dark} label="Descuentos" value={`-${payrollDiscounts}`} />
      </div>
      <div className={`mt-5 rounded-2xl p-4 ${dark ? "bg-white/10" : "bg-[#4c5638] text-[#ffffff]"}`}>
        <p className={`text-sm ${dark ? "text-[#cac5a7]" : "text-[#cac5a7]"}`}>Total a pagar</p>
        <p className="mt-1 text-3xl font-semibold brand-serif">{total}</p>
      </div>
    </div>
  );
}

function PayLine({ dark, label, value }: { dark: boolean; label: string; value: string }) {
  return <div className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${dark ? "bg-white/10" : "bg-white/60"}`}><span className={dark ? "text-[#cac5a7]" : "text-[#7a625c]"}>{label}</span><span className="font-semibold">{value}</span></div>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[2rem] border border-white/45 bg-[#ffffff]/88 p-5 shadow-xl shadow-[#4c5638]/5 backdrop-blur"><h2 className="mb-4 text-2xl font-semibold text-[#4c5638] brand-serif">{title}</h2>{children}</section>;
}

function Form({ action, children }: { action: (formData: FormData) => Promise<void>; children: React.ReactNode }) {
  return <form className="grid gap-3" action={action}>{children}</form>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...inputProps } = props;
  return <label className="grid gap-1 text-sm font-medium text-[#5d4743]">{label}<input className="rounded-2xl border border-[#cac5a7] bg-white/60 px-3 py-2 text-sm outline-none transition focus:border-[#8a966d]" {...inputProps} /></label>;
}

function Select({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: string[] }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-[#5d4743]">
      {label}
      <select className="rounded-2xl border border-[#cac5a7] bg-white/60 px-3 py-2 text-sm outline-none transition focus:border-[#8a966d]" {...props}>
        {options.map((option) => <option key={option} value={option}>{optionLabel(option)}</option>)}
      </select>
    </label>
  );
}

function Submit({ children }: { children: React.ReactNode }) {
  return <button className={primaryButton} type="submit">{children}</button>;
}

function BrandMark({ centered = false }: { centered?: boolean }) {
  return (
    <div className={`relative h-20 w-20 overflow-hidden rounded-full border border-[#cac5a7]/35 bg-[#4c5638] shadow-lg shadow-black/15 ${centered ? "mx-auto" : "shrink-0"}`}>
      <Image src="/luma-logo.png" alt="LUMA" fill sizes="80px" className="object-cover" priority />
    </div>
  );
}
