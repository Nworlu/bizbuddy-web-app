import { Suspense } from "react";
import { SaleDetailsRoute } from "@/features/sales/screen/sale-details-screen";

// Static page: the record id is read from ?id= in the browser (see shared/lib/routes.ts).
export default function Page() {
  return (
    <Suspense>
      <SaleDetailsRoute />
    </Suspense>
  );
}
