import { EditExpensePage } from "@/features/expenses/screen/record-expense-screen";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditExpensePage id={id} />;
}
