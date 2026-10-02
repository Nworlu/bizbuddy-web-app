import type { Metadata } from "next";
import { LandingScreen } from "@/features/marketing/screen/landing-screen";
import { FAQ } from "@/features/marketing/content/faq";
import { PLANS } from "@/features/billing/content/plans";
import { SITE_DESCRIPTION, SITE_TITLE, siteUrl } from "@/shared/lib/site";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: SITE_TITLE, description: SITE_DESCRIPTION, url: "/" },
};

export default function HomePage() {
  const url = siteUrl().origin;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "BizBuddy",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url,
        description: SITE_DESCRIPTION,
        inLanguage: "en-NG",
        offers: PLANS.map((plan) => ({
          "@type": "Offer",
          name: plan.name,
          price: String(plan.amount),
          priceCurrency: "NGN",
          description: plan.comingSoon ? `Coming soon. ${plan.summary}` : plan.summary,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <LandingScreen />
    </>
  );
}
