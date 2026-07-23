import { defineField, defineType } from "sanity";

// The block whitelist. Engineering adds block types here (and their renderers
// in the app); marketing composes pages from them. This boundary is what lets
// marketing publish freely without ever touching application code.

const cta = (name: string, title: string) =>
  defineField({
    name, title, type: "object",
    fields: [
      defineField({ name: "label", title: "Button text", type: "string" }),
      defineField({ name: "href", title: "Button link", type: "string", description: "e.g. /enterprise/plans or https://go.jobsai.work/…" }),
    ],
  });

export const heroBlock = defineType({
  name: "heroBlock", title: "Hero", type: "object",
  fields: [
    defineField({ name: "eyebrow", title: "Eyebrow", type: "string", description: "Small label above the heading, e.g. 'For staffing agencies'" }),
    defineField({ name: "heading", title: "Heading", type: "string", validation: (r) => r.required() }),
    defineField({ name: "subheading", title: "Subheading", type: "text", rows: 2 }),
    cta("primaryCta", "Primary button"),
    cta("secondaryCta", "Secondary button"),
  ],
  preview: { select: { title: "heading" }, prepare: ({ title }) => ({ title: title ?? "Hero", subtitle: "Hero" }) },
});

export const richTextBlock = defineType({
  name: "richTextBlock", title: "Text", type: "object",
  fields: [
    defineField({
      name: "content", title: "Content", type: "array",
      of: [
        { type: "block", styles: [
          { title: "Normal", value: "normal" },
          { title: "Heading", value: "h2" },
          { title: "Subheading", value: "h3" },
          { title: "Quote", value: "blockquote" },
        ] },
        { type: "image", options: { hotspot: true }, fields: [defineField({ name: "alt", title: "Alt text", type: "string" })] },
      ],
    }),
  ],
  preview: { prepare: () => ({ title: "Text section" }) },
});

export const featureGridBlock = defineType({
  name: "featureGridBlock", title: "Feature grid", type: "object",
  fields: [
    defineField({ name: "heading", title: "Heading", type: "string" }),
    defineField({
      name: "items", title: "Features", type: "array",
      of: [{
        type: "object",
        fields: [
          defineField({ name: "name", title: "Name", type: "string" }),
          defineField({ name: "description", title: "Description", type: "text", rows: 2 }),
        ],
      }],
    }),
  ],
  preview: { select: { title: "heading" }, prepare: ({ title }) => ({ title: title ?? "Feature grid", subtitle: "Feature grid" }) },
});

export const faqListBlock = defineType({
  name: "faqListBlock", title: "FAQ list", type: "object",
  fields: [
    defineField({ name: "heading", title: "Heading", type: "string" }),
    defineField({
      name: "items", title: "Questions", type: "array",
      of: [{
        type: "object",
        fields: [
          defineField({ name: "question", title: "Question", type: "string" }),
          defineField({ name: "answer", title: "Answer", type: "text", rows: 3 }),
        ],
      }],
    }),
  ],
  preview: { select: { title: "heading" }, prepare: ({ title }) => ({ title: title ?? "FAQ", subtitle: "FAQ list" }) },
});

export const ctaBlock = defineType({
  name: "ctaBlock", title: "Call to action", type: "object",
  fields: [
    defineField({ name: "heading", title: "Heading", type: "string", validation: (r) => r.required() }),
    defineField({ name: "subheading", title: "Subheading", type: "text", rows: 2 }),
    cta("cta", "Button"),
  ],
  preview: { select: { title: "heading" }, prepare: ({ title }) => ({ title: title ?? "CTA", subtitle: "Call to action" }) },
});

export const bookingBlock = defineType({
  name: "bookingBlock", title: "Book a demo widget", type: "object",
  fields: [
    defineField({ name: "heading", title: "Heading", type: "string" }),
  ],
  preview: { prepare: () => ({ title: "Book a demo widget" }) },
});
