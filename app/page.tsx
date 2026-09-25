import type { Metadata } from "next";
import { LandingScreen } from "@/features/marketing/screen/landing-screen";
import { FAQ } from "@/features/marketing/content/faq";

export const metadata: Metadata = {
  title: "BizBuddy — know who still owes you",
  description: "A simple book for Nigerian shops. Record a sale, what was paid, and what you spent. See who still owes you, in naira, on your phone.",
  openGraph: {
    title: "BizBuddy — know who still owes you",
    description: "Record sales, part payments, and expenses. See who still owes you.",
    locale: "en_NG",
    type: "website",
  },
};

export default function HomePage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <LandingScreen />
    </>
  );
}
