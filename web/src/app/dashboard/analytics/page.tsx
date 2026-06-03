import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";

export default function AnalyticsPage() {
  return (
    <>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">
            Insights
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your job search at a glance — match trends, pipeline health, and skill gaps.
          </p>
        </div>

        <div className="mt-8">
          <AnalyticsDashboard />
        </div>
      </main>
    </>
  );
}
