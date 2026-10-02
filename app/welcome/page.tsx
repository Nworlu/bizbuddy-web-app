import type { Metadata } from "next";
import { Suspense } from "react";
import WelcomeScreen, { WelcomeLoading } from "@/features/onboarding/screen/welcome-screen";

export const metadata: Metadata = { title: "Start your books", robots: { index: false, follow: false } };

// The screen reads ?demo=1 with useSearchParams, which needs a Suspense boundary for the page to prerender.
export default function WelcomePage() {
  return (
    <Suspense fallback={<WelcomeLoading />}>
      <WelcomeScreen />
    </Suspense>
  );
}
