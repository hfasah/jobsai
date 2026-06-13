import { Lightbulb } from "lucide-react";
import type { GuideSection } from "@/lib/enterprise-guide";

function Section({ section, startIndex }: { section: GuideSection; startIndex: number }) {
  return (
    <section className="mt-8 first:mt-0">
      {section.heading && <h2 className="text-xl font-bold tracking-tight">{section.heading}</h2>}

      {section.body?.map((p, i) => (
        <p key={i} className="mt-3 leading-relaxed text-muted-foreground">{p}</p>
      ))}

      {section.steps && (
        <ol className="mt-4 space-y-3">
          {section.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {startIndex + i + 1}
              </span>
              <span className="pt-0.5 leading-relaxed text-foreground">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {section.tip && (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm leading-relaxed text-foreground/90">{section.tip}</p>
        </div>
      )}
    </section>
  );
}

// Renders an article's sections. Step numbers run continuously across sections
// that have steps, so a multi-section how-to reads as one sequence. Start
// offsets are precomputed immutably (no reassignment during render).
export function GuideArticleBody({ sections }: { sections: GuideSection[] }) {
  const startIndices: number[] = [];
  sections.reduce((sum, s) => {
    startIndices.push(sum);
    return sum + (s.steps?.length ?? 0);
  }, 0);

  return (
    <div>
      {sections.map((section, i) => (
        <Section key={i} section={section} startIndex={startIndices[i]} />
      ))}
    </div>
  );
}
