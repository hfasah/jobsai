import Link from "next/link";

import { SiteHeaderAuth } from "@/components/layout/site-header-auth";
import { APP_NAME } from "@/lib/constants";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          <span className="text-desyn-brand">{APP_NAME}</span>
        </Link>
        <SiteHeaderAuth />
      </div>
    </header>
  );
}
