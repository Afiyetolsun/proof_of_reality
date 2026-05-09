import Link from "next/link";

export type Sort = "newest" | "oldest";
/**
 * Mode values match `CAPTURE_MODES` in packages/proof-bundle/src/schema.ts.
 * If new modes get added there, add them here too — type-checking won't
 * catch the drift since we read modes as plain strings off-chain.
 */
export type ModeFilter = "all" | "roomPlan" | "objectCapture" | "stereoFusion";

const MODE_VALUES = ["roomPlan", "objectCapture", "stereoFusion"] as const;

export interface FilterState {
  sort: Sort;
  mode: ModeFilter;
  hasToken: boolean;
}

export function parseFilters(sp: Record<string, string | string[] | undefined>): FilterState {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const sort = get("sort") === "oldest" ? "oldest" : "newest";
  const modeRaw = get("mode");
  const mode: ModeFilter = (MODE_VALUES as readonly string[]).includes(modeRaw ?? "")
    ? (modeRaw as ModeFilter)
    : "all";
  const hasToken = get("token") === "1";
  return { sort, mode, hasToken };
}

function buildHref(state: FilterState, override: Partial<FilterState>): string {
  const next = { ...state, ...override };
  const params = new URLSearchParams();
  if (next.sort !== "newest") params.set("sort", next.sort);
  if (next.mode !== "all") params.set("mode", next.mode);
  if (next.hasToken) params.set("token", "1");
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function Filters({ state, total }: { state: FilterState; total: number }) {
  return (
    <div className="container-page mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 pb-2">
      <span className="text-mono-s text-[--color-ink-mute]">
        {total} {total === 1 ? "scan" : "scans"}
      </span>

      <FilterGroup label="mode">
        <Pill href={buildHref(state, { mode: "all" })} active={state.mode === "all"}>
          all
        </Pill>
        <Pill href={buildHref(state, { mode: "objectCapture" })} active={state.mode === "objectCapture"}>
          object
        </Pill>
        <Pill href={buildHref(state, { mode: "roomPlan" })} active={state.mode === "roomPlan"}>
          room
        </Pill>
        <Pill href={buildHref(state, { mode: "stereoFusion" })} active={state.mode === "stereoFusion"}>
          stereo
        </Pill>
      </FilterGroup>

      <FilterGroup label="sort">
        <Pill href={buildHref(state, { sort: "newest" })} active={state.sort === "newest"}>
          newest
        </Pill>
        <Pill href={buildHref(state, { sort: "oldest" })} active={state.sort === "oldest"}>
          oldest
        </Pill>
      </FilterGroup>

      <FilterGroup label="onchain">
        <Pill href={buildHref(state, { hasToken: false })} active={!state.hasToken}>
          any
        </Pill>
        <Pill href={buildHref(state, { hasToken: true })} active={state.hasToken}>
          minted
        </Pill>
      </FilterGroup>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-eyebrow font-mono text-[--color-ink-faint]">{label}</span>
      <div className="flex items-center gap-1 rounded-full border border-[--color-rule] bg-[--color-surface-raised] p-0.5">
        {children}
      </div>
    </div>
  );
}

function Pill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`rounded-full px-3 py-1 text-mono-xs transition-colors ${
        active
          ? "bg-[--color-signal-soft] text-[--color-signal]"
          : "text-[--color-ink-mute] hover:text-[--color-ink]"
      }`}
    >
      {children}
    </Link>
  );
}
