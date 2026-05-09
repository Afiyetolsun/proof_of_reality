import { Suspense } from "react";
import { listSubnames } from "@/lib/ens-subgraph";
import { hydrateRecords, type SubnameRecord } from "@/lib/ens-records";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/Card";
import { Filters, parseFilters, type FilterState } from "@/components/Filters";
import { ensAppParentUrl } from "@/lib/viewer-link";
import { LandingSearch } from "@/components/LandingSearch";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function GalleryPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filters = parseFilters(sp);

  return (
    <>
      <Header />
      <main id="content" className="pb-12">
        {/* Hero: same monospace + diamond-icon vibe as the per-proof page,
            centered and tight. Short tagline mirrors the per-proof page
            ("Cryptographic capture of physical reality. Verified by four
            independent witnesses.") so visitors hitting the index get the
            same one-line claim before they click into a single proof. */}
        <section className="container-page pb-10 pt-12 text-center md:pt-20">
          <div
            aria-hidden
            className="mx-auto text-[40px] leading-none text-[--color-signal]"
            style={{ filter: "drop-shadow(0 0 18px oklch(0.74 0.14 58 / 0.40))" }}
          >
            ◆
          </div>
          <h1 className="mx-auto mt-5 max-w-[20ch] text-display-m font-mono text-[--color-ink]">
            proof of reality
          </h1>
          <p className="mx-auto mt-4 max-w-[52ch] text-body text-[--color-ink-mute]">
            Cryptographic captures of the physical world. Each scan signed by
            four independent witnesses.
          </p>
          <LandingSearch />
        </section>

        <Suspense fallback={<GalleryFallback filters={filters} />}>
          <GalleryBody filters={filters} />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}

async function GalleryBody({ filters }: { filters: FilterState }) {
  let records: SubnameRecord[] = [];
  let error: string | null = null;
  try {
    const subnames = await listSubnames({ first: 200 });
    records = await hydrateRecords(subnames);
  } catch (e) {
    error = (e as Error).message;
  }

  const filtered = applyFilters(records, filters);

  return (
    <>
      <Filters state={filters} total={filtered.length} />
      <section className="container-page pt-6">
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
      <section className="container-page pt-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/5] animate-pulse border border-[--color-rule] bg-[--color-surface-raised]"
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
    <div className="border border-[--color-rule] bg-[--color-surface-raised] px-6 py-8">
      <div className="text-eyebrow font-mono text-[--color-warn]">subgraph error</div>
      <p className="mt-2 text-body text-[--color-ink]">
        Couldn&apos;t reach the ENS Sepolia subgraph.
      </p>
      <p className="mt-2 text-mono-s text-[--color-ink-mute]">{message}</p>
      <a
        href={ensAppParentUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-block text-mono-s text-[--color-signal] underline decoration-transparent underline-offset-4 hover:decoration-[--color-signal]"
      >
        Browse on the ENS app ↗
      </a>
    </div>
  );
}

function EmptyBlock() {
  return (
    <div className="border border-dashed border-[--color-rule] bg-[--color-surface-raised] px-6 py-12 text-center">
      <div className="text-eyebrow font-mono text-[--color-ink-mute]">no scans match</div>
      <p className="mt-3 text-body text-[--color-ink-mute]">
        Adjust the filters above, or be the first to mint a scan and watch it land here.
      </p>
    </div>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 30;
