import { Suspense } from "react";
import { EditCustomerRoute } from "@/features/customers/screen/edit-customer-screen";

// Static page: the record id is read from ?id= in the browser (see shared/lib/routes.ts).
export default function Page() {
  return (
    <Suspense>
      <EditCustomerRoute />
    </Suspense>
  );
}
