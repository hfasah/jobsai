import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { GuideSidebar } from "@/components/enterprise/guide-sidebar";

// Shared docs layout: marketing header, a sticky left sidebar (searchable), the
// article/content area, and the marketing footer. Used by the guide index and
// every article page.
export function GuideLayout({ activeSlug, children }: { activeSlug?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2">
            <GuideSidebar activeSlug={activeSlug} />
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      </div>

      <PublicEnterpriseFooter />
    </main>
  );
}
