import { RecordSalePage } from "@/features/sales/screen/record-sale-screen";

// ?customer=<id> fills in the customer, e.g. from "Record a sale" on a customer's page.
export default async function Page({ searchParams }: { searchParams: Promise<{ customer?: string | string[] }> }) {
  const { customer } = await searchParams;
  return <RecordSalePage customerId={typeof customer === "string" ? customer : undefined} />;
}
