import { Suspense } from "react";
import WelcomeScreen, { WelcomeLoading } from "@/features/onboarding/screen/welcome-screen";

// The screen reads ?demo=1 with useSearchParams, which needs a Suspense boundary for the page to prerender.
export default function WelcomePage() {
  return (
    <Suspense fallback={<WelcomeLoading />}>
      <WelcomeScreen />
    </Suspense>
  );
}
