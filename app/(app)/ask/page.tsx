import { Suspense } from "react";
import { AskPage } from "@/features/ask/screen/ask-screen";

// AskPage reads ?q= with useSearchParams, which needs a Suspense boundary for the page to prerender.
export default function Page() {
  return (
    <Suspense>
      <AskPage />
    </Suspense>
  );
}
