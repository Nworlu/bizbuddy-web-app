// The rules for recording a sale, a customer's payment, or an expense, as pure functions: books in,
// new books out. The phone's store (store.ts) saves the result to localStorage; the WhatsApp webhook
// saves it to the server. One set of rules, wherever the record comes from.

import { allocatePayment } from "./finance";
import type { BizData, Customer, Expense, ExpenseCategory, LocalDate, Payment, PaymentMethod } from "./types";

/** Money is stored in whole naira. The screen rounds to whole naira, so kobo would make balances look wrong. */
export function isWholeNaira(amount: number): boolean {
  return Number.isSafeInteger(amount);
}

/** A name as typed, with spaces tidied: "  Sarah   Ibrahim " becomes "Sarah Ibrahim". */
export function tidyName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** The existing customer with this name, ignoring case and extra spaces anywhere in it. */
export function findCustomerByName(data: BizData, name: string): Customer | undefined {
  const wanted = tidyName(name).toLowerCase();
  return data.customers.find((customer) => tidyName(customer.name).toLowerCase() === wanted);
}

/** The customer with this name, or a new one added to the list. Sales find customers by name. */
export function customerNamed(data: BizData, rawName: string): { customer: Customer; customers: Customer[] } {
  const name = tidyName(rawName);
  if (!name) throw new Error("Customer name is required");
  const existing = findCustomerByName(data, name);
  if (existing) return { customer: existing, customers: data.customers };
  const customer: Customer = { id: crypto.randomUUID(), name, phone: "", createdAt: new Date().toISOString() };
  return { customer, customers: [...data.customers, customer] };
}

export type SaleInput = { customerName: string; product: string; totalAmount: number; amountPaid: number; method: PaymentMethod; date: LocalDate };

/** Creates the customer when the name is new, then the sale, then a payment when they paid something. */
export function withSale(data: BizData, input: SaleInput): { data: BizData; customerName: string; outstanding: number } {
  if (!isWholeNaira(input.totalAmount) || input.totalAmount <= 0) throw new Error("Sale amount must be whole naira above 0");
  if (!isWholeNaira(input.amountPaid) || input.amountPaid < 0 || input.amountPaid > input.totalAmount) throw new Error("Amount paid must be whole naira, up to the sale amount");
  const { customer, customers } = customerNamed(data, input.customerName);
  const saleId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const sales = [...data.sales, { id: saleId, customerId: customer.id, product: input.product.trim(), totalAmount: input.totalAmount, date: input.date, createdAt }];
  const payments = input.amountPaid > 0 ? [...data.payments, { id: crypto.randomUUID(), saleId, customerId: customer.id, amount: input.amountPaid, method: input.method, date: input.date, createdAt }] : data.payments;
  return { data: { ...data, customers, sales, payments }, customerName: customer.name, outstanding: input.totalAmount - input.amountPaid };
}

export type CustomerPaymentInput = { customerId: string; amount: number; method: PaymentMethod; date: LocalDate };

/**
 * Money a customer paid without naming a sale. It pays off their unpaid sales oldest first,
 * one Payment per sale, all sharing a batchId so they show as one payment.
 */
export function withCustomerPayment(data: BizData, input: CustomerPaymentInput): { data: BizData; parts: NonNullable<ReturnType<typeof allocatePayment>> } {
  if (!isWholeNaira(input.amount) || input.amount <= 0) throw new Error("Payment must be whole naira above 0");
  const parts = allocatePayment(input.customerId, input.amount, input.date, data);
  if (!parts || parts.length === 0) throw new Error("Payment is more than what was owed on that date");
  const batchId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const payments: Payment[] = parts.map((part) => ({
    id: crypto.randomUUID(),
    saleId: part.sale.id,
    customerId: input.customerId,
    batchId,
    amount: part.amount,
    method: input.method,
    date: input.date,
    createdAt,
  }));
  return { data: { ...data, payments: [...data.payments, ...payments] }, parts };
}

export type ExpenseInput = { category: ExpenseCategory; amount: number; description: string; date: LocalDate };

export function withExpense(data: BizData, input: ExpenseInput): { data: BizData; expense: Expense } {
  if (!isWholeNaira(input.amount) || input.amount <= 0) throw new Error("Expense must be whole naira above 0");
  const expense: Expense = { id: crypto.randomUUID(), category: input.category, amount: input.amount, description: input.description.trim(), date: input.date, createdAt: new Date().toISOString() };
  return { data: { ...data, expenses: [...data.expenses, expense] }, expense };
}
