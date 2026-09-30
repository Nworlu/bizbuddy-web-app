import { Suspense } from "react";
import { TellPage } from "@/features/tell/screen/tell-screen";

// TellPage reads ?q= (a note from the dashboard) with useSearchParams, which needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <TellPage />
    </Suspense>
  );
}
