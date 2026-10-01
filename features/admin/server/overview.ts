// Server only: platform stats for /admin (uses Supabase secret key when available).

import { db } from "@/features/whatsapp/server/books";
import { adminEnabled } from "@/shared/lib/admin-session";

export type AdminOverview = {
  enabled: boolean;
  integrations: {
    accounts: boolean;
    loginEmail: boolean;
    openai: boolean;
    whatsapp: boolean;
    supabaseSecret: boolean;
    cron: boolean;
    appUrl: boolean;
  };
  counts: {
    businesses: number | null;
    customers: number | null;
    sales: number | null;
    expenses: number | null;
  };
  recentBusinesses: { name: string; ownerName: string; phone: string; createdAt: string }[];
};

async function headCount(table: "businesses" | "customers" | "sales" | "expenses"): Promise<number | null> {
  try {
    const { count, error } = await db().from(table).select("*", { count: "exact", head: true });
    if (error) throw error;
    return count ?? 0;
  } catch {
    return null;
  }
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const integrations = {
    accounts: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    loginEmail: Boolean(process.env.NEXT_PUBLIC_LOGIN_EMAIL),
    openai: Boolean(process.env.OPENAI_API_KEY),
    whatsapp: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_APP_SECRET),
    supabaseSecret: Boolean(process.env.SUPABASE_SECRET_KEY),
    cron: Boolean(process.env.CRON_SECRET),
    appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
  };

  let counts: AdminOverview["counts"] = { businesses: null, customers: null, sales: null, expenses: null };
  let recentBusinesses: AdminOverview["recentBusinesses"] = [];

  if (integrations.supabaseSecret && integrations.accounts) {
    const [businesses, customers, sales, expenses] = await Promise.all([
      headCount("businesses"),
      headCount("customers"),
      headCount("sales"),
      headCount("expenses"),
    ]);
    counts = { businesses, customers, sales, expenses };
    try {
      const { data } = await db()
        .from("businesses")
        .select("name, owner_name, phone, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      recentBusinesses =
        data?.map((row) => ({
          name: row.name as string,
          ownerName: row.owner_name as string,
          phone: (row.phone as string) ?? "",
          createdAt: row.created_at as string,
        })) ?? [];
    } catch {
      recentBusinesses = [];
    }
  }

  return { enabled: adminEnabled(), integrations, counts, recentBusinesses };
}
