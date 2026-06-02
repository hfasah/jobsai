"use client";

import { useRef, useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function TagInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setInput("");
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={cn(
        "flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 cursor-text",
        "focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-shadow",
        className
      )}
    >
      {value.map((tag, i) => (
        <span
          key={i}
          className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-medium text-primary"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeTag(i); }}
            className="hover:text-destructive transition-colors"
            aria-label={`Remove ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
