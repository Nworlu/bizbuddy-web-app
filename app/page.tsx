import type { Metadata } from "next";
import { LandingScreen } from "@/features/marketing/screen/landing-screen";
import { FAQ } from "@/features/marketing/content/faq";

export const metadata: Metadata = {
  title: "BizBuddy — run the shop from one book",
  description: "A book for Nigerian shops. Record what you sold, what came in, and what you spent.",
  openGraph: {
    title: "BizBuddy — run the shop from one book",
    description: "Record what you sold, what came in, and what you spent.",
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
