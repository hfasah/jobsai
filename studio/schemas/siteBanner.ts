import { defineField, defineType } from "sanity";

// Scheduled promo banner shown at the top of public enterprise marketing pages.
// Set the window and it appears/disappears on its own. No deploys, ever.

export const siteBanner = defineType({
  name: "siteBanner",
  title: "Site banner",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Internal name", type: "string", description: "For your own reference, e.g. 'August fair promo'. Not shown to visitors.", validation: (r) => r.required() }),
    defineField({ name: "enabled", title: "Enabled", type: "boolean", initialValue: true }),
    defineField({ name: "message", title: "Message", type: "string", description: "The banner text, e.g. 'Today only: 50% off with code'", validation: (r) => r.required().max(120) }),
    defineField({ name: "code", title: "Promo code", type: "string", description: "Optional. Shown in a highlighted pill after the message." }),
    defineField({ name: "linkLabel", title: "Link label", type: "string", description: "Optional link text, e.g. 'Start your trial'" }),
    defineField({ name: "linkHref", title: "Link URL", type: "string", description: "Where the link goes, e.g. /enterprise/plans" }),
    defineField({
      name: "theme", title: "Color", type: "string", initialValue: "emerald",
      options: { list: [
        { title: "Green", value: "emerald" },
        { title: "Indigo", value: "indigo" },
        { title: "Amber", value: "amber" },
      ], layout: "radio" },
    }),
    defineField({ name: "startAt", title: "Show from", type: "datetime", validation: (r) => r.required() }),
    defineField({ name: "endAt", title: "Show until", type: "datetime", validation: (r) => r.required() }),
  ],
  preview: {
    select: { title: "title", subtitle: "message" },
  },
});
