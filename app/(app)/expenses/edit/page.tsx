import { Suspense } from "react";
import { EditExpenseRoute } from "@/features/expenses/screen/record-expense-screen";

// Static page: the record id is read from ?id= in the browser (see shared/lib/routes.ts).
export default function Page() {
  return (
    <Suspense>
      <EditExpenseRoute />
    </Suspense>
  );
}
