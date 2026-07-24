import Link from "next/link";
import { sanityImageUrl } from "@/lib/sanity";
import { LeadForm } from "@/components/enterprise/lead-form";

// The whitelisted block library for CMS-composed marketing pages. Marketing
// composes pages out of these in Sanity Studio; engineering owns what each
// block can render. Server components only — this file must never import
// database, auth, or billing code.

// ── Portable Text (minimal renderer, no dependency) ─────────────────────────

interface PTSpan { _type: "span"; text: string; marks?: string[] }
interface PTMarkDef { _key: string; _type: string; href?: string }
interface PTBlock {
  _key: string;
  _type: string;
  style?: string;
  listItem?: string;
  markDefs?: PTMarkDef[];
  children?: PTSpan[];
  asset?: { _ref?: string };
  alt?: string;
}

function renderSpans(block: PTBlock) {
  return (block.children ?? []).map((span, i) => {
    let node: React.ReactNode = span.text;
    for (const mark of span.marks ?? []) {
      if (mark === "strong") node = <strong key={`${i}-s`}>{node}</strong>;
      else if (mark === "em") node = <em key={`${i}-e`}>{node}</em>;
      else {
        const def = (block.markDefs ?? []).find((d) => d._key === mark);
        if (def?._type === "link" && def.href) {
          const external = /^https?:\/\//.test(def.href) && !def.href.includes("jobsai.work");
          node = (
            <a key={`${i}-a`} href={def.href} className="text-primary underline underline-offset-2"
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              {node}
            </a>
          );
        }
      }
    }
    return <span key={span.text + i}>{node}</span>;
  });
}

export function PortableText({ value }: { value: PTBlock[] }) {
  const out: React.ReactNode[] = [];
  let list: PTBlock[] = [];

  const flushList = () => {
    if (!list.length) return;
    const ordered = list[0].listItem === "number";
    const items = list.map((b) => <li key={b._key}>{renderSpans(b)}</li>);
    out.push(
      ordered
        ? <ol key={list[0]._key + "-l"} className="ml-5 list-decimal space-y-1.5 text-muted-foreground">{items}</ol>
        : <ul key={list[0]._key + "-l"} className="ml-5 list-disc space-y-1.5 text-muted-foreground">{items}</ul>,
    );
    list = [];
  };

  for (const block of value ?? []) {
    if (block.listItem) { list.push(block); continue; }
    flushList();
    if (block._type === "image") {
      const src = sanityImageUrl(block.asset?._ref);
      if (src) {
        // eslint-disable-next-line @next/next/no-img-element
        out.push(<img key={block._key} src={src} alt={block.alt ?? ""} className="my-6 w-full rounded-2xl border border-border" />);
      }
      continue;
    }
    if (block._type !== "block") continue;
    switch (block.style) {
      case "h2": out.push(<h2 key={block._key} className="mt-10 text-2xl font-bold tracking-tight">{renderSpans(block)}</h2>); break;
      case "h3": out.push(<h3 key={block._key} className="mt-8 text-lg font-semibold">{renderSpans(block)}</h3>); break;
      case "blockquote": out.push(<blockquote key={block._key} className="my-6 border-l-2 border-primary/50 pl-4 italic text-muted-foreground">{renderSpans(block)}</blockquote>); break;
      default: out.push(<p key={block._key} className="my-4 leading-relaxed text-muted-foreground">{renderSpans(block)}</p>);
    }
  }
  flushList();
  return <div className="max-w-3xl">{out}</div>;
}

// ── Block types ─────────────────────────────────────────────────────────────

interface Cta { label?: string; href?: string }
export interface HeroBlock { _type: "heroBlock"; _key: string; eyebrow?: string; heading?: string; subheading?: string; primaryCta?: Cta; secondaryCta?: Cta }
export interface RichTextBlock { _type: "richTextBlock"; _key: string; content?: PTBlock[] }
export interface FeatureGridBlock { _type: "featureGridBlock"; _key: string; heading?: string; items?: { _key: string; name?: string; description?: string }[] }
export interface FaqListBlock { _type: "faqListBlock"; _key: string; heading?: string; items?: { _key: string; question?: string; answer?: string }[] }
export interface CtaBlock { _type: "ctaBlock"; _key: string; heading?: string; subheading?: string; cta?: Cta }
export interface BookingBlock { _type: "bookingBlock"; _key: string; heading?: string }
export interface LeadFormBlock { _type: "leadFormBlock"; _key: string; heading?: string; subheading?: string; buttonLabel?: string; successMessage?: string; tag?: string; showPhone?: boolean }
export interface GhlEmbedBlock { _type: "ghlEmbedBlock"; _key: string; heading?: string; url?: string; height?: number }

export type MarketingBlock = HeroBlock | RichTextBlock | FeatureGridBlock | FaqListBlock | CtaBlock | BookingBlock | LeadFormBlock | GhlEmbedBlock;

// Only GoHighLevel's own widget hosts may be embedded — anything else is
// silently dropped (protects the page from arbitrary third-party iframes).
const GHL_EMBED_HOSTS = new Set(["api.leadconnectorhq.com", "link.msgsndr.com"]);
function safeGhlUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && GHL_EMBED_HOSTS.has(u.hostname) ? u.toString() : null;
  } catch { return null; }
}

// Same LeadConnector widget the /enterprise/demo page embeds.
const BOOKING_SRC = "https://api.leadconnectorhq.com/widget/booking/5HFMVFvz8AJQ4gjY7B9F";

function CtaLink({ cta, primary }: { cta: Cta; primary?: boolean }) {
  if (!cta.label || !cta.href) return null;
  return (
    <Link href={cta.href}
      className={primary
        ? "rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        : "rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"}>
      {cta.label}
    </Link>
  );
}

// ── Renderer ────────────────────────────────────────────────────────────────

export function MarketingBlocks({ blocks }: { blocks: MarketingBlock[] }) {
  return (
    <>
      {blocks.map((block) => {
        switch (block._type) {
          case "heroBlock":
            return (
              <section key={block._key} className="mx-auto max-w-5xl px-4 pb-16 pt-20 text-center sm:px-6">
                {block.eyebrow && (
                  <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-primary">{block.eyebrow}</p>
                )}
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{block.heading}</h1>
                {block.subheading && (
                  <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">{block.subheading}</p>
                )}
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  {block.primaryCta && <CtaLink cta={block.primaryCta} primary />}
                  {block.secondaryCta && <CtaLink cta={block.secondaryCta} />}
                </div>
              </section>
            );
          case "richTextBlock":
            return (
              <section key={block._key} className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
                <PortableText value={block.content ?? []} />
              </section>
            );
          case "featureGridBlock":
            return (
              <section key={block._key} className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
                {block.heading && <h2 className="mb-8 text-center text-3xl font-bold tracking-tight">{block.heading}</h2>}
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {(block.items ?? []).map((item) => (
                    <div key={item._key} className="rounded-2xl border border-border bg-card p-6">
                      <h3 className="font-semibold">{item.name}</h3>
                      {item.description && <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>}
                    </div>
                  ))}
                </div>
              </section>
            );
          case "faqListBlock":
            return (
              <section key={block._key} className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
                {block.heading && <h2 className="mb-8 text-center text-3xl font-bold tracking-tight">{block.heading}</h2>}
                <div className="space-y-3">
                  {(block.items ?? []).map((item) => (
                    <details key={item._key} className="group rounded-2xl border border-border bg-card px-6 py-4">
                      <summary className="cursor-pointer list-none font-medium marker:hidden">{item.question}</summary>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            );
          case "ctaBlock":
            return (
              <section key={block._key} className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
                <div className="rounded-3xl border border-border bg-card px-6 py-12 text-center">
                  <h2 className="text-3xl font-bold tracking-tight">{block.heading}</h2>
                  {block.subheading && <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{block.subheading}</p>}
                  {block.cta && (
                    <div className="mt-7 flex justify-center"><CtaLink cta={block.cta} primary /></div>
                  )}
                </div>
              </section>
            );
          case "bookingBlock":
            return (
              <section key={block._key} className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
                {block.heading && <h2 className="mb-6 text-center text-3xl font-bold tracking-tight">{block.heading}</h2>}
                <iframe src={BOOKING_SRC} title="Book a demo"
                  className="h-[780px] w-full rounded-2xl border border-border bg-card" />
              </section>
            );
          case "ghlEmbedBlock": {
            const src = safeGhlUrl(block.url);
            if (!src) return null;
            return (
              <section key={block._key} className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
                {block.heading && <h2 className="mb-6 text-center text-3xl font-bold tracking-tight">{block.heading}</h2>}
                <iframe src={src} title={block.heading || "GoHighLevel widget"}
                  style={{ height: `${Math.min(Math.max(block.height ?? 700, 200), 2400)}px` }}
                  className="w-full rounded-2xl border border-border bg-card" />
              </section>
            );
          }
          case "leadFormBlock":
            return (
              <section key={block._key} className="mx-auto max-w-xl px-4 py-12 sm:px-6">
                <LeadForm heading={block.heading} subheading={block.subheading} buttonLabel={block.buttonLabel}
                  successMessage={block.successMessage} tag={block.tag} showPhone={block.showPhone} />
              </section>
            );
          default:
            return null;
        }
      })}
    </>
  );
}
