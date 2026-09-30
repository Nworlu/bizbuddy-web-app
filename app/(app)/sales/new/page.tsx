import { Suspense } from "react";
import { RecordSaleRoute } from "@/features/sales/screen/record-sale-screen";

// Static page: ?customer=<id> is read in the browser (see shared/lib/routes.ts).
export default function Page() {
  return (
    <Suspense>
      <RecordSaleRoute />
    </Suspense>
  );
}
