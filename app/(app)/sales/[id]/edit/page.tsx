import { EditSalePage } from "@/features/sales/screen/edit-sale-screen";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditSalePage id={id} />;
}
