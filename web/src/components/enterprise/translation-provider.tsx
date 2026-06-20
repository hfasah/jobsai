"use client";

// On-demand whole-app translation for the enterprise app.
//
// A language switcher writes the chosen language to localStorage and reloads.
// On load (and on client-side navigation, via a MutationObserver), if a
// non-English language is selected we walk the rendered text nodes, batch them
// to /api/translate, and replace them in place — covering menus AND document
// content with one switcher. Originals are remembered per node, and per-string
// translations are cached in localStorage so repeated labels are free.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Globe, Check } from "lucide-react";

export type Lang = { code: string; native: string; name: string };

// native = shown in the dropdown; name = English name sent to the translator.
export const LANGUAGES: Lang[] = [
  { code: "en", native: "English", name: "English" },
  { code: "fr", native: "Français", name: "French" },
  { code: "es", native: "Español", name: "Spanish" },
  { code: "pt", native: "Português", name: "Portuguese" },
  { code: "de", native: "Deutsch", name: "German" },
  { code: "it", native: "Italiano", name: "Italian" },
  { code: "ar", native: "العربية", name: "Arabic" },
  { code: "zh", native: "中文", name: "Chinese (Simplified)" },
  { code: "hi", native: "हिन्दी", name: "Hindi" },
];

const STORAGE_KEY = "ent-lang";

const LangContext = createContext<{ lang: string; setLang: (code: string) => void }>({
  lang: "en",
  setLang: () => {},
});

export function useLang() {
  return useContext(LangContext);
}

// ── DOM translation engine ──────────────────────────────────────────────────
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE", "SVG"]);
const originalText = new WeakMap<Text, string>();

function langName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? "English";
}

function cacheKey(code: string) {
  return `transcache:${code}`;
}

function collectNodes(root: Node): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const value = n.nodeValue ?? "";
      const trimmed = value.trim();
      if (trimmed.length < 2) return NodeFilter.FILTER_REJECT; // skip blanks/single chars
      if (!/[A-Za-z]/.test(trimmed)) return NodeFilter.FILTER_REJECT; // skip pure numbers/symbols
      const parent = (n as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-no-translate]")) return NodeFilter.FILTER_REJECT;
      if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  return nodes;
}

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState("en");
  const cacheRef = useRef<Record<string, string>>({});
  const inflight = useRef(false);

  // Translate (or restore) the given text nodes for the active language.
  const translateNodes = useCallback(async (nodes: Text[], code: string) => {
    if (!nodes.length) return;
    const cache = cacheRef.current;
    const pending: string[] = [];
    const seen = new Set<string>();

    for (const node of nodes) {
      // Remember the English original the first time we touch a node.
      if (!originalText.has(node)) originalText.set(node, node.nodeValue ?? "");
      const source = originalText.get(node) ?? "";
      const key = source.trim();
      if (cache[key] == null && !seen.has(key)) {
        seen.add(key);
        pending.push(key);
      }
    }

    // Fetch missing translations in chunks.
    for (let i = 0; i < pending.length; i += 50) {
      const chunk = pending.slice(i, i + 50);
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: chunk, target: langName(code) }),
        });
        const json = await res.json();
        const translations: string[] = Array.isArray(json.translations) ? json.translations : chunk;
        chunk.forEach((src, idx) => {
          cache[src] = translations[idx] ?? src;
        });
      } catch {
        chunk.forEach((src) => (cache[src] = src));
      }
    }

    // Apply: preserve each node's original leading/trailing whitespace.
    for (const node of nodes) {
      const source = originalText.get(node) ?? "";
      const translated = cache[source.trim()];
      if (translated == null) continue;
      const lead = source.match(/^\s*/)?.[0] ?? "";
      const trail = source.match(/\s*$/)?.[0] ?? "";
      node.nodeValue = `${lead}${translated}${trail}`;
    }

    try {
      localStorage.setItem(cacheKey(code), JSON.stringify(cache));
    } catch {
      /* quota — fine */
    }
  }, []);

  useEffect(() => {
    let active = "en";
    try {
      active = localStorage.getItem(STORAGE_KEY) || "en";
    } catch {
      /* ignore */
    }
    // Sync from localStorage on mount — can't be read during SSR render, so this
    // intentionally happens in an effect (hydration-safe).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLangState(active);
    if (active === "en") return;

    // Warm the per-language cache from localStorage.
    try {
      cacheRef.current = JSON.parse(localStorage.getItem(cacheKey(active)) || "{}");
    } catch {
      cacheRef.current = {};
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      if (inflight.current) return;
      inflight.current = true;
      translateNodes(collectNodes(document.body), active).finally(() => {
        inflight.current = false;
      });
    };
    // Initial pass + a re-run for any async content.
    run();
    const t0 = setTimeout(run, 800);

    // Catch client-side navigation / lazily-rendered content.
    const observer = new MutationObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, 400);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      clearTimeout(t0);
      if (timer) clearTimeout(timer);
    };
  }, [translateNodes]);

  const setLang = useCallback((code: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
    // Reload so the DOM resets to English first; the effect re-translates if
    // a non-English language is selected. Simplest robust way to switch.
    window.location.reload();
  }, []);

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

// ── Switcher UI ──────────────────────────────────────────────────────────────
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <div className={`relative ${className}`} data-no-translate>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
      >
        <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-left">{current.native}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-50 mb-1 max-h-72 w-full min-w-[10rem] overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (l.code !== lang) setLang(l.code);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span>{l.native}</span>
                {l.code === lang && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
