"use client";

import { X, HelpCircle, Download } from "lucide-react";
import { LINKEDIN_EXTENSION_ZIP } from "@/lib/constants";

export function LinkedInExtensionModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Download LinkedIn Extension"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-center text-xl font-bold tracking-tight">Download LinkedIn Extension!</h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">
          An additional Chrome extension is required to use JobsAI on LinkedIn. Click the button below
          to download it, then follow the steps to install it in your browser:
        </p>

        <ol className="mt-5 space-y-2 text-sm">
          {[
            <>Download the extension zip file.</>,
            <>Extract the downloaded zip file to a folder on your computer.</>,
            <>Open Google Chrome and go to <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-primary">chrome://extensions/</code></>,
            <>Enable <strong>&ldquo;Developer mode&rdquo;</strong> using the toggle in the top right corner.</>,
            <>Click <strong>&ldquo;Load unpacked&rdquo;</strong> and select the folder where you extracted the extension.</>,
            <>The extension should now be installed and active in your browser!</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={LINKEDIN_EXTENSION_ZIP}
            download
            className="btn-cta inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-6 text-sm sm:w-auto"
          >
            <Download className="h-4 w-4" />
            Download Extension
          </a>
          <a
            href="https://jobsai.work/contact"
            target="_blank"
            rel="noopener"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 px-6 text-sm font-medium text-primary transition-colors hover:bg-primary/10 sm:w-auto"
          >
            <HelpCircle className="h-4 w-4" />
            Need Help?
          </a>
        </div>
      </div>
    </div>
  );
}
