export const BUSINESS_TYPES = ["Fashion", "Food", "Beauty", "Electronics", "Retail", "Services", "Other"] as const;
export const PAYMENT_METHODS = ["Bank Transfer", "Cash", "POS", "Other"] as const;
export const EXPENSE_CATEGORIES = ["Stock", "Delivery", "Packaging", "Transport", "Rent", "Salaries", "Marketing", "Other"] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Calendar date in the user's local time zone, formatted YYYY-MM-DD. */
export type LocalDate = string;

export interface Business {
  /** The shop's id on the server. Set when the shop is created; older saved shops get one when they start backing up. */
  id?: string;
  name: string;
  ownerName: string;
  /** Shop owner's phone. Older records saved before this field existed may omit it. */
  phone?: string;
  type: BusinessType;
  /** What the business is about, in the owner's words. Sent to the AI so it knows the shop. */
  about?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

/**
 * A sale records what was sold and for how much. It does not store what was paid:
 * every naira received is a Payment linked to the sale, so balances have one source of truth.
 */
export interface Sale {
  id: string;
  customerId: string;
  product: string;
  totalAmount: number;
  date: LocalDate;
  createdAt: string;
}

export interface Payment {
  id: string;
  saleId: string;
  /**
   * Set when one payment from a customer was split across several sales (oldest first).
   * Every part shares the batchId, so the app can show it as a single payment.
   */
  batchId?: string;
  customerId: string;
  amount: number;
  method: PaymentMethod;
  date: LocalDate;
  createdAt: string;
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  date: LocalDate;
  createdAt: string;
}

export interface BizData {
  version: 1;
  /** The sample shop (Ada's Fashion). Never sent to an account. */
  demo?: boolean;
  business: Business | null;
  customers: Customer[];
  sales: Sale[];
  payments: Payment[];
  expenses: Expense[];
}
