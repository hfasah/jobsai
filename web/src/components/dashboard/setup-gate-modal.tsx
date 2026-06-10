"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, CheckCircle2, Settings, User, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SetupGateModalProps {
  open: boolean;
  onClose: () => void;
  hasResume?: boolean;
  hasJobPreferences?: boolean;
  hasApplyProfile?: boolean;
}

export function SetupGateModal({
  open,
  onClose,
  hasResume = false,
  hasJobPreferences = false,
  hasApplyProfile = false,
}: SetupGateModalProps) {
  const router = useRouter();

  if (!open) return null;

  const completed = [hasResume, hasJobPreferences, hasApplyProfile].filter(Boolean).length;
  const total = 3;

  const handleNavigate = (href: string) => {
    router.push(href);
  };

  const steps = [
    {
      id: "resume",
      icon: FileText,
      title: "Upload Resume",
      description: "Add at least one resume to get started. You can upload multiple versions for different roles.",
      href: "/dashboard/resumes",
      done: hasResume,
    },
    {
      id: "preferences",
      icon: Settings,
      title: "Set Job Preferences",
      description: "Tell us your target roles, locations, salary expectations, and auto-apply rules.",
      href: "/dashboard/preferences",
      done: hasJobPreferences,
    },
    {
      id: "profile",
      icon: User,
      title: "Update Apply Profile",
      description: "Add personal info, work authorization, sponsorship needs, and references for applications.",
      href: "/dashboard/apply-profile",
      done: hasApplyProfile,
    },
  ];

  const allComplete = completed === total;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Orange Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 sm:px-8 py-6 sm:py-8">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1 text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Ready to find your next opportunity?
          </h2>
          <p className="text-white/90 text-sm sm:text-base">
            Complete these 3 steps to unlock the full power of JobsAI
          </p>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{completed} of {total} complete</span>
              <span className="text-muted-foreground">{total - completed} to go</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-primary transition-all duration-500"
                style={{ width: `${(completed / total) * 100}%` }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <Link
                  key={step.id}
                  href={step.href}
                  onClick={onClose}
                  className={cn(
                    "group rounded-lg border-2 p-4 transition-all cursor-pointer hover:border-primary/50 block",
                    step.done
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        {step.done ? (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold group-hover:text-primary transition-colors">
                            {step.title}
                          </h3>
                          {step.done && (
                            <span className="text-xs font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              Done
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                      {!step.done && (
                        <div className="flex-shrink-0 flex items-center">
                          <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors cursor-pointer">
                            Start →
                          </span>
                        </div>
                      )}
                    </div>
                </Link>
              );
            })}
          </div>

          {/* Footer Info */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-3 border border-border/50">
            <div className="flex items-start gap-2">
              <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <strong>Full access</strong> to job discovery, auto-apply, and AI interview prep unlocks when all 3 steps are complete.
              </p>
            </div>

            <div className="flex items-start gap-2 pt-2 border-t border-border/50">
              <span className="text-lg">💡</span>
              <p className="text-xs text-muted-foreground">
                <strong>Pro tip:</strong> For best results and experience, use a desktop and download our Chrome extension for automated job applications.
              </p>
            </div>
          </div>

          {/* CTA */}
          {allComplete && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 text-center">
              <p className="text-sm font-semibold text-emerald-600 mb-3">
                ✓ You're all set! Ready to discover opportunities.
              </p>
              <Button onClick={onClose} className="w-full">
                Start Exploring Jobs
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
