/**
 * Gallery landing.
 *
 * Layout intentionally mirrors apps/gallery/src/app/[name]/page.tsx
 * (centered diamond + mono hero, single-column tagline + search, then
 * filters and the card grid below). The site-wide Header / Footer
 * chrome from src/components/* is dropped here so the index and the
 * detail pages share one visual voice.
 *
 * The orange diamond ◆ is the "little orange from our icon" — used
 * sparingly so the page reads mint/sky/white with a single warm accent
 * holding the brand.
 */
import { Suspense } from "react";
import Link from "next/link";
import { listSubnames } from "@/lib/ens-subgraph";
import { hydrateRecords, type SubnameRecord } from "@/lib/ens-records";
import { isResolverConfigured, listProofsFromResolver } from "@/lib/ens-resolver";
import { Card } from "@/components/Card";
import { Filters, parseFilters, type FilterState } from "@/components/Filters";
import { ensAppParentUrl, ensParentName } from "@/lib/viewer-link";
import { LandingSearch } from "@/components/LandingSearch";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function GalleryPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filters = parseFilters(sp);

  return (
    <main id="content" className="pb-20">
      <section className="mx-auto max-w-[880px] px-5 pb-10 pt-16 text-center md:pt-20">
        <div
          aria-hidden
          className="mx-auto text-[44px] leading-none text-[--color-signal]"
          style={{ filter: "drop-shadow(0 0 22px oklch(0.74 0.14 58 / 0.55))" }}
        >
          ◆
        </div>
        <h1 className="mx-auto mt-5 max-w-[20ch] font-mono text-display-m text-[--color-ink]">
          proof of reality
        </h1>
        <p className="mx-auto mt-4 max-w-[52ch] text-body text-[--color-ink]">
          Cryptographic captures of the physical world. Each scan signed by
          four independent witnesses.
        </p>
        <LandingSearch />
        <p className="mx-auto mt-4 max-w-[52ch] text-mono-s text-[--color-ink-mute]">
          Or browse every minted proof below — each card is a subname under{" "}
          <a
            href={ensAppParentUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[--color-link] underline decoration-transparent underline-offset-4 hover:decoration-[--color-link]"
          >
            {ensParentName} ↗
          </a>
          .
        </p>
      </section>

      <div className="mx-auto max-w-[1280px] px-5">
        <Suspense fallback={<GalleryFallback filters={filters} />}>
          <GalleryBody filters={filters} />
        </Suspense>
      </div>

      <footer className="mx-auto mt-16 flex max-w-[1280px] items-center justify-between border-t border-[--color-rule] px-5 pt-5 text-mono-s text-[--color-ink-mute]">
        <span>Built for ETHPrague 2026 · SpaceComputer + ENS + Swarm</span>
        <a
          href="https://github.com/Afiyetolsun/proof_of_reality"
          target="_blank"
          rel="noreferrer"
          className="text-[--color-link] transition-colors hover:opacity-80"
        >
          GitHub ↗
        </a>
      </footer>
    </main>
  );
}

async function GalleryBody({ filters }: { filters: FilterState }) {
  let records: SubnameRecord[] = [];
  let error: string | null = null;
  // Primary path: read ProofPublished events from the resolver contract.
  // It's the source of truth for "what scans exist on ENS"; the subgraph
  // is only a fallback for environments that haven't wired up the
  // resolver address.
  try {
    if (isResolverConfigured()) {
      records = await listProofsFromResolver();
    } else {
      const subnames = await listSubnames({ first: 200 });
      records = await hydrateRecords(subnames);
    }
  } catch (e) {
    error = (e as Error).message;
  }

  const filtered = applyFilters(records, filters);

  return (
    <>
      <Filters state={filters} total={filtered.length} />
      <section className="pt-6">
        {error && <ErrorBlock message={error} />}
        {!error && filtered.length === 0 && <EmptyBlock />}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((r) => (
              <Card key={r.name} record={r} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function GalleryFallback({ filters }: { filters: FilterState }) {
  return (
    <>
      <Filters state={filters} total={0} />
      <section className="pt-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/5] animate-pulse rounded-[20px] border border-[--color-rule] bg-[--color-surface-raised]"
            />
          ))}
        </div>
      </section>
    </>
  );
}

function applyFilters(records: SubnameRecord[], f: FilterState): SubnameRecord[] {
  let out = records;
  if (f.mode !== "all") {
    out = out.filter((r) => r.mode === f.mode);
  }
  if (f.hasToken) {
    out = out.filter((r) => r.tokenId !== null);
  }
  out = [...out].sort((a, b) =>
    f.sort === "newest" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
  );
  return out;
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-[20px] border border-[--color-rule] bg-[--color-surface-raised] px-6 py-8">
      <div className="text-eyebrow font-mono uppercase tracking-[0.12em] text-[--color-warn]">
        subgraph error
      </div>
      <p className="mt-2 text-body text-[--color-ink]">
        Couldn&apos;t reach the ENS Sepolia subgraph.
      </p>
      <p className="mt-2 text-mono-s text-[--color-ink-mute]">{message}</p>
      <a
        href={ensAppParentUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-block text-mono-s text-[--color-link] underline decoration-transparent underline-offset-4 hover:decoration-[--color-link]"
      >
        Browse on the ENS app ↗
      </a>
    </div>
  );
}

function EmptyBlock() {
  return (
    <div className="rounded-[20px] border border-dashed border-[--color-rule] bg-[--color-surface-raised] px-6 py-12 text-center">
      <div className="text-eyebrow font-mono uppercase tracking-[0.12em] text-[--color-accent]">
        no scans match
      </div>
      <p className="mt-3 text-body text-[--color-ink]">
        Adjust the filters above, or be the first to mint a scan and watch it
        land here.
      </p>
    </div>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 30;
