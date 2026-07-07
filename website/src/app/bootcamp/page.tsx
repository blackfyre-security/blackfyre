import type { Metadata, Viewport } from "next";
import "@/components/bootcamp/bootcamp.css";
import BootcampNav from "@/components/bootcamp/sections/Nav";
import Hero from "@/components/bootcamp/sections/Hero";
import Audience from "@/components/bootcamp/sections/Audience";
import Problem from "@/components/bootcamp/sections/Problem";
import StickyApply from "@/components/bootcamp/sections/StickyApply";
import Transformation from "@/components/bootcamp/sections/Transformation";
import Outcomes from "@/components/bootcamp/sections/Outcomes";
import Curriculum from "@/components/bootcamp/sections/Curriculum";
import Framework from "@/components/bootcamp/sections/Framework";
import Instructor from "@/components/bootcamp/sections/Instructor";
import Testimonials from "@/components/bootcamp/sections/Testimonials";
import Pricing from "@/components/bootcamp/sections/Pricing";
import Faq from "@/components/bootcamp/sections/Faq";
import FinalCta from "@/components/bootcamp/sections/FinalCta";
import Footer from "@/components/bootcamp/sections/Footer";

const TITLE = "AI Product Builder Bootcamp — Build your first AI product in 5 days";
const DESCRIPTION =
  "A 5-day live online cohort that takes you from idea to a working AI prototype, pitch deck, and go-to-market plan. No coding required. Limited to 25 students. ₹25,000.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "AI bootcamp",
    "AI product builder",
    "build AI product",
    "no-code AI",
    "live cohort",
    "product management bootcamp",
    "AI for students",
    "prototype",
    "pitch deck",
    "go-to-market",
  ],
  alternates: { canonical: "/bootcamp" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://blackfyre.tech/bootcamp",
    siteName: "AI Product Builder Bootcamp",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#07080b",
  colorScheme: "dark",
};

const courseSchema = {
  "@context": "https://schema.org",
  "@type": "Course",
  name: "AI Product Builder Bootcamp",
  description: DESCRIPTION,
  provider: { "@type": "Organization", name: "BLACKFYRE", url: "https://blackfyre.tech" },
  hasCourseInstance: {
    "@type": "CourseInstance",
    courseMode: "online",
    courseWorkload: "P5D",
    offers: {
      "@type": "Offer",
      price: "25000",
      priceCurrency: "INR",
      availability: "https://schema.org/LimitedAvailability",
    },
  },
};

export default function BootcampPage() {
  return (
    <div className="bp-scope bp-noise min-h-screen overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseSchema) }}
      />
      <BootcampNav />
      <Hero />
      <Audience />
      <Problem />
      <Transformation />
      <Outcomes />
      <Curriculum />
      <Framework />
      <Instructor />
      <Testimonials />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
      <StickyApply />
    </div>
  );
}
