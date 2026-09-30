import { Suspense } from "react";
import { EditSaleRoute } from "@/features/sales/screen/edit-sale-screen";

// Static page: the record id is read from ?id= in the browser (see shared/lib/routes.ts).
export default function Page() {
  return (
    <Suspense>
      <EditSaleRoute />
    </Suspense>
  );
}
