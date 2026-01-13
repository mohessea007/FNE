import { 
  User, 
  Company, 
  PointDeVente, 
  Client, 
  Invoice, 
  ItemInvoice, 
  InvoiceLog,
} from '@prisma/client';

// Extended types with relations
export interface UserWithRelations extends User {
  company?: Company | null;
  client?: Client | null;
}

export interface CompanyWithRelations extends Company {
  pointdeventes: PointDeVente[];
  clients?: Client[];
  invoices?: Invoice[];
  users?: User[];
}

export interface PointDeVenteWithRelations extends PointDeVente {
  company?: Company;
  clients?: Client[];
}

export interface ClientWithRelations extends Client {
  company?: Company;
  pointdevente?: PointDeVente;
  invoices?: Invoice[];
}

export interface InvoiceWithRelations extends Invoice {
  company?: Company;
  pointdevente?: PointDeVente;
  client?: Client;
  items: ItemInvoice[];
  logs?: InvoiceLog[];
  originalInvoice?: Invoice | null;
  refunds?: Invoice[];
}

export interface InvoiceLogWithRelations extends InvoiceLog {
  company?: Company;
  pointdevente?: PointDeVente;
  invoice?: Invoice;
  user?: User;
}

// Dashboard stats
export interface AdminStats {
  totalCompanies: number;
  totalUsers: number;
  totalInvoices: number;
  totalInvoicesCertified: number;
  totalInvoicesRejected: number;
  recentInvoices: InvoiceWithRelations[];
  invoicesByType: { type: string; count: number }[];
  invoicesByMonth: { month: string; count: number }[];
}

export interface CompanyStats {
  totalInvoices: number;
  totalClients: number;
  totalPointsDeVente: number;
  totalRevenue: number;
  invoicesByStatus: { status: string; count: number }[];
  recentInvoices: InvoiceWithRelations[];
  logsStats: {
    success: number;
    error: number;
    total: number;
  };
}

export interface ClientStats {
  totalInvoices: number;
  totalAmount: number;
  recentInvoices: InvoiceWithRelations[];
}

// Session types
export interface SessionUser {
  id: number;
  username: string;
  nom: string;
  email?: string | null;
  type_user: string;
  role: string;
  is_dev: number;
  is_admin: number;
  is_superadmin: number;
  companieid?: number | null;
  clientid?: number | null;
  company?: Company | null;
  client?: Client | null;
}

// API Response types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Re-export Prisma types
export type {
  User,
  Company,
  PointDeVente,
  Client,
  Invoice,
  ItemInvoice,
  InvoiceLog,
};
