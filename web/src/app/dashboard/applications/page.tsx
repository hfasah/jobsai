import { SiteHeader } from "@/components/layout/site-header";
import { ApplicationBoard } from "@/components/application/application-board";

export default function ApplicationsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">
            Application tracker
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Your Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track each application through your hiring pipeline. Drag a card to move it between stages.
          </p>
        </div>

        <div className="mt-8">
          <ApplicationBoard />
        </div>
      </main>
    </>
  );
}
