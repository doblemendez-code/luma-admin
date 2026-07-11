export type Provider = string;
export type PaymentMethod = "Transferencia" | "Efectivo" | "Tarjeta" | "Mixto";
export type SalaryMode = "none" | "fixed" | "if_service";

export type Client = {
  id: string;
  full_name: string;
  phone: string | null;
  instagram: string | null;
  notes: string | null;
  created_at?: string;
};

export type Appointment = {
  id: string;
  client_id: string | null;
  client_name: string;
  requested_service: string;
  provider: Provider;
  appointment_at: string;
  contact_channel: "WhatsApp" | "Instagram";
  reschedule_count: number;
  no_show: boolean;
  canceled: boolean;
  created_at?: string;
};

export type ServiceRecord = {
  id: string;
  appointment_id: string | null;
  client_id: string | null;
  service_name: string;
  provider: Provider;
  service_date: string;
  cost: number;
  payment_method: PaymentMethod;
  cash_amount: number;
  transfer_amount: number;
  card_amount: number;
  tip_amount: number;
  tip_payment_method: "Transferencia" | "Efectivo" | null;
  notes: string | null;
  created_at?: string;
};

export type Expense = {
  id: string;
  concept: string;
  expense_date: string;
  amount: number;
  payment_method: "Efectivo de caja" | "Transferencia";
  category: "Insumos" | "Limpieza" | "Renta" | "Otros";
  created_at?: string;
};

export type PayrollDeduction = {
  id: string;
  employee_id: string | null;
  employee_name: string;
  deduction_date: string;
  amount: number;
  reason: string;
  created_at?: string;
};

export type Employee = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string;
  salary: number;
  commission_rate: number;
  deduct_card_fee: boolean;
  monday_commission_rate: number;
  monday_salary: number;
  monday_salary_mode: SalaryMode;
  tuesday_commission_rate: number;
  tuesday_salary: number;
  tuesday_salary_mode: SalaryMode;
  wednesday_commission_rate: number;
  wednesday_salary: number;
  wednesday_salary_mode: SalaryMode;
  thursday_commission_rate: number;
  thursday_salary: number;
  thursday_salary_mode: SalaryMode;
  friday_commission_rate: number;
  friday_salary: number;
  friday_salary_mode: SalaryMode;
  saturday_commission_rate: number;
  saturday_salary: number;
  saturday_salary_mode: SalaryMode;
  sunday_commission_rate: number;
  sunday_salary: number;
  sunday_salary_mode: SalaryMode;
  is_active: boolean;
  created_at?: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "business";
};
