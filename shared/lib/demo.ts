import { daysAgo } from "./dates";
import type { BizData, Expense, Payment, PaymentMethod, Sale } from "./types";

/** Sample data for Ada's Fashion, dated relative to today so the dashboard always has something to show. */
export function demoData(): BizData {
  const stamp = (n: number) => `${daysAgo(n)}T12:00:00.000Z`;

  const customers = [
    { id: "c1", name: "David Okafor", phone: "08031234567", createdAt: stamp(40) },
    { id: "c2", name: "Sarah Ibrahim", phone: "08051234567", createdAt: stamp(35) },
    { id: "c3", name: "Chinedu Eze", phone: "08071234567", createdAt: stamp(30) },
    { id: "c4", name: "Amaka Johnson", phone: "08091234567", createdAt: stamp(20) },
  ];

  const sales: Sale[] = [];
  const payments: Payment[] = [];
  const sell = (id: string, customerId: string, product: string, total: number, paid: number, method: PaymentMethod, ago: number) => {
    sales.push({ id, customerId, product, totalAmount: total, date: daysAgo(ago), createdAt: stamp(ago) });
    if (paid > 0) {
      payments.push({ id: `p-${id}`, saleId: id, customerId, amount: paid, method, date: daysAgo(ago), createdAt: stamp(ago) });
    }
  };

  sell("s1", "c1", "Sneakers", 85000, 50000, "Bank Transfer", 2);
  sell("s2", "c2", "Ankara Dress", 70000, 70000, "POS", 3);
  sell("s3", "c3", "Corporate Shirts (3)", 45000, 20000, "Cash", 5);
  sell("s4", "c4", "Designer Bag", 55000, 55000, "Bank Transfer", 7);
  sell("s5", "c1", "Polo Shirt", 30000, 30000, "Cash", 10);
  sell("s6", "c2", "Heels (2 pairs)", 60000, 40000, "Bank Transfer", 12);
  sell("s7", "c4", "Aso Oke Set", 120000, 120000, "Bank Transfer", 35);

  // David later paid part of what he owed on the sneakers.
  payments.push({ id: "p-late-1", saleId: "s1", customerId: "c1", amount: 20000, method: "Bank Transfer", date: daysAgo(1), createdAt: stamp(1) });

  const expense = (id: string, category: Expense["category"], amount: number, description: string, ago: number): Expense => ({
    id, category, amount, description, date: daysAgo(ago), createdAt: stamp(ago),
  });

  return {
    version: 1,
    demo: true,
    business: { name: "Ada's Fashion", ownerName: "Ada", phone: "08012345678", type: "Fashion", createdAt: stamp(40) },
    customers,
    sales,
    payments,
    expenses: [
      expense("e1", "Stock", 120000, "New stock from Aba market", 4),
      expense("e2", "Delivery", 4000, "Lagos delivery runs", 6),
      expense("e3", "Packaging", 8000, "Nylon bags and tags", 8),
      expense("e4", "Transport", 37000, "Market and supplier runs", 14),
      expense("e5", "Rent", 150000, "Shop rent", 33),
    ],
  };
}
