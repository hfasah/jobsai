import Image from "next/image";

// Scrolling brand logo cloud + the "Work Smarter, Not Harder." statement.
// Logos live in /public/marketing/logos (transparent PNGs). Add more by dropping
// a file in and appending it here.
const LOGOS = [
  { src: "/marketing/logos/google.png", alt: "Google", w: 161, h: 46 },
  { src: "/marketing/logos/spotify.png", alt: "Spotify", w: 138, h: 47 },
  { src: "/marketing/logos/meta.png", alt: "Meta", w: 166, h: 43 },
  { src: "/marketing/logos/spacex.png", alt: "SpaceX", w: 161, h: 46 },
  { src: "/marketing/logos/microsoft.png", alt: "Microsoft", w: 202, h: 45 },
];

// Repeat so the row is wide, then duplicate the whole sequence for a seamless
// -50% loop.
const SEQ = [...LOGOS, ...LOGOS, ...LOGOS];

export function TrustedMarquee() {
  return (
    <section className="relative overflow-hidden border-t border-border/60 px-4 py-20 sm:px-6">
      <p className="text-center text-sm font-medium text-muted-foreground">
        Trusted by job seekers landing roles at top companies across the US, UK, Canada &amp; Europe
      </p>

      <div className="marquee-row marquee-mask mt-8 flex overflow-hidden">
        <div className="marquee-track flex w-max shrink-0 items-center gap-12 pr-12 sm:gap-16 sm:pr-16">
          {[...SEQ, ...SEQ].map((l, i) => (
            <Image
              key={i}
              src={l.src}
              alt={l.alt}
              width={l.w}
              height={l.h}
              className="h-6 w-auto opacity-60 transition-opacity hover:opacity-100 sm:h-8"
            />
          ))}
        </div>
      </div>

      <div className="mx-auto mt-14 max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
          Work <span className="text-gradient">Smarter</span>, Not Harder.
        </h2>
      </div>
    </section>
  );
}
