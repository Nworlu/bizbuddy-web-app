import { db } from "@/features/whatsapp/server/books";

export type AdminBusinessRow = {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  type: string;
  created_at: string;
  updated_at: string;
};

export async function fetchAdminOverview(): Promise<{ total: number; businesses: AdminBusinessRow[] }> {
  const { data, error, count } = await db()
    .from("businesses")
    .select("id, name, owner_name, phone, type, created_at, updated_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return { total: count ?? data?.length ?? 0, businesses: (data ?? []) as AdminBusinessRow[] };
}
