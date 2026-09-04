export interface MonitorSubscriptionItem {
  order_name: string;
  partner_name: string;
  imei: string;
  device_product: string;
  sucursal: string;
  operador: string;
  overdue_count: number;
  fecha_promesa_pago: string;
  has_promise: boolean;
  promesa_vencida: boolean;
  has_recent_payment: boolean;
  status_type: "bloqueado" | "promesa" | "tolerancia" | "al_dia";
  status_label: string;
  badge_class: string;
}

export interface MonitorTopBranch {
  branch_name: string;
  count: number;
  percent: number;
}

export interface MonitorReportData {
  total_orders: number;
  total_imeis: number;
  count_al_dia: number;
  count_promesa: number;
  count_promesa_protegida: number;
  count_promesas_vigentes: number;
  count_promesas_vencidas: number;
  count_tolerancia: number;
  count_bloqueados: number;
  count_habilitados: number;
  percent_bloqueados: number;
  percent_habilitados: number;
  top_branches: MonitorTopBranch[];
  items: MonitorSubscriptionItem[];
  odoo_db?: string;
  odoo_url?: string;
  generated_at?: string;
  error?: string;
}
