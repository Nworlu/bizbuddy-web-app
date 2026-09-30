import { Suspense } from "react";
import { CustomerDetailsRoute } from "@/features/customers/screen/customer-details-screen";

// Static page: the record id is read from ?id= in the browser (see shared/lib/routes.ts).
export default function Page() {
  return (
    <Suspense>
      <CustomerDetailsRoute />
    </Suspense>
  );
}
