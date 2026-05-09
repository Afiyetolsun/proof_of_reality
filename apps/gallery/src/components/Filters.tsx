import Link from "next/link";

export type Sort = "newest" | "oldest";
/**
 * Mode values match `CAPTURE_MODES` in packages/proof-bundle/src/schema.ts.
 * stereoFusion exists in the schema but no scans use it yet, so we don't
 * surface it in the filter UI — when (if) it ships, add a "stereo" pill.
 */
export type ModeFilter = "all" | "roomPlan" | "objectCapture";

const MODE_VALUES = ["roomPlan", "objectCapture"] as const;

export interface FilterState {
  sort: Sort;
  mode: ModeFilter;
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
  return { sort, mode };
}

function buildHref(state: FilterState, override: Partial<FilterState>): string {
  const next = { ...state, ...override };
  const params = new URLSearchParams();
  if (next.sort !== "newest") params.set("sort", next.sort);
  if (next.mode !== "all") params.set("mode", next.mode);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function Filters({ state, total }: { state: FilterState; total: number }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 pb-2">
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
      </FilterGroup>

      <FilterGroup label="sort">
        <Pill href={buildHref(state, { sort: "newest" })} active={state.sort === "newest"}>
          newest
        </Pill>
        <Pill href={buildHref(state, { sort: "oldest" })} active={state.sort === "oldest"}>
          oldest
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
          ? "bg-[--color-accent-soft] text-[--color-accent]"
          : "text-[--color-ink-mute] hover:text-[--color-ink]"
      }`}
    >
      {children}
    </Link>
  );
}
