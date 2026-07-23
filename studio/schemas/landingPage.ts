import { defineField, defineType } from "sanity";

// A campaign landing page composed from the block whitelist. Publishes to
// app.jobsai.work/enterprise/lp/<slug> within seconds.

export const landingPage = defineType({
  name: "landingPage",
  title: "Landing page",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Page title", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug", title: "URL slug", type: "slug",
      description: "The page will live at app.jobsai.work/enterprise/lp/<slug>",
      options: { source: "title", maxLength: 60 },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "blocks", title: "Page sections", type: "array",
      of: [
        { type: "heroBlock" },
        { type: "richTextBlock" },
        { type: "featureGridBlock" },
        { type: "faqListBlock" },
        { type: "ctaBlock" },
        { type: "bookingBlock" },
      ],
      validation: (r) => r.min(1),
    }),
    defineField({ name: "seoTitle", title: "SEO title", type: "string", description: "Browser tab + search result title. Falls back to the page title.", validation: (r) => r.max(60) }),
    defineField({ name: "seoDescription", title: "SEO description", type: "text", rows: 2, validation: (r) => r.max(160) }),
    defineField({ name: "noIndex", title: "Hide from search engines", type: "boolean", initialValue: false, description: "Turn on for short-lived campaign pages that should not be indexed." }),
  ],
  preview: {
    select: { title: "title", subtitle: "slug.current" },
    prepare: ({ title, subtitle }) => ({ title, subtitle: subtitle ? `/enterprise/lp/${subtitle}` : "" }),
  },
});
