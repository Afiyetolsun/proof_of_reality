import Link from "next/link";

export type Sort = "newest" | "oldest";

/**
 * Mode values:
 *   featured       — curated default. Filters out auto-generated
 *                    `vin-…` test labels by counting digits across the
 *                    entire ENS name; >4 digits in the FQDN means it's
 *                    almost certainly a vin- (12-hex VIN) or a noisy
 *                    timestamped test, not a human-readable scan.
 *   all            — every scan in the index.
 *   roomPlan       — RoomPlan captures only.
 *   objectCapture  — Object Capture only.
 *
 * stereoFusion exists in packages/proof-bundle/src/schema.ts but no
 * scans use it yet, so it isn't surfaced as a pill — add one when (if)
 * it ships.
 */
export type ModeFilter = "featured" | "all" | "roomPlan" | "objectCapture";

const MODE_VALUES = ["featured", "all", "roomPlan", "objectCapture"] as const;

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
    : "featured";
  return { sort, mode };
}

/**
 * Heuristic for the "featured" pill.
 *
 * Includes a scan when EITHER:
 *
 *   1. The ENS name has ≤ 4 digits across the whole FQDN. This filters
 *      out the auto-generated 12-hex `vin-…` labels (always ≥9
 *      digits) without iOS needing to opt in.
 *      e.g. `pizza.realityproof.eth` (0), `my-flat-2026.realityproof.eth` (4) ✓
 *      e.g. `vin-0712b563e5b1.realityproof.eth` (9) ✗
 *
 *   2. The scan was created on or after **today's UTC midnight**. New
 *      mints surface on the index immediately even if they used the
 *      vin- placeholder — so people testing the iOS app right now see
 *      their own scans without having to switch the filter to "all".
 *      Roll-over is automatic: once the date crosses, yesterday's vin
 *      scans drop back behind the digit-count gate.
 *
 * Tweak the digit threshold or the cutoff in this function — it's the
 * single source of truth for the featured pill.
 */
function todayStartUtc(): number {
  const d = new Date();
  return Math.floor(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000,
  );
}

export function isFeatured(record: {
  name: string;
  createdAt: number;
}): boolean {
  if (record.createdAt >= todayStartUtc()) return true;
  const digitCount = (record.name.match(/\d/g) ?? []).length;
  return digitCount <= 4;
}

function buildHref(state: FilterState, override: Partial<FilterState>): string {
  const next = { ...state, ...override };
  const params = new URLSearchParams();
  if (next.sort !== "newest") params.set("sort", next.sort);
  // featured is the default — don't add to URL
  if (next.mode !== "featured") params.set("mode", next.mode);
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
        <Pill
          href={buildHref(state, { mode: "featured" })}
          active={state.mode === "featured"}
          title="Curated picks — hides auto-generated VIN labels"
        >
          featured
        </Pill>
        <Pill href={buildHref(state, { mode: "all" })} active={state.mode === "all"}>
          all
        </Pill>
        <Pill
          href={buildHref(state, { mode: "objectCapture" })}
          active={state.mode === "objectCapture"}
        >
          object
        </Pill>
        <Pill
          href={buildHref(state, { mode: "roomPlan" })}
          active={state.mode === "roomPlan"}
        >
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
  title,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      title={title}
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
