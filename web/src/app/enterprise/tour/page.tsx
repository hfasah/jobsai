import type { Metadata } from "next";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { ProductTour } from "@/components/enterprise/product-tour";

export const metadata: Metadata = {
  title: "Take the tour — JobsAI Enterprise",
  description: "A self-serve, no-login walkthrough of JobsAI Enterprise — from AI sourcing and multi-channel outreach to AI screening, pipeline, offers, and analytics.",
  alternates: { canonical: "/enterprise/tour" },
};

export default function TourPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />

      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-6 py-14 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Interactive tour</p>
        <h1 className="mx-auto mt-2 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">See JobsAI Enterprise — no booking required</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
          Step through the whole hiring loop: source, reach, screen, move, and decide. Two minutes, no login.
        </p>
      </section>

      <ProductTour />

      <PublicEnterpriseFooter />
    </main>
  );
}
