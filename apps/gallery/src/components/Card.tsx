import Link from "next/link";
import type { SubnameRecord } from "@/lib/ens-records";
import { contentDirectUrl, ensAppForName, viewerForName } from "@/lib/viewer-link";
import { Eyebrow } from "./Eyebrow";
import { Mono, shortHex, shortAddress } from "./Mono";
import { CardThumbnail } from "./CardThumbnail";
import { CardScene } from "./CardScene";

export function Card({ record }: { record: SubnameRecord }) {
  const captureLabel = formatCapture(record.capturedAt ?? record.createdAt);
  const viewerHref = viewerForName(record.name);
  const sceneUrl = record.content
    ? `/api/scene?proto=${record.content.protocol}&ref=${encodeURIComponent(record.content.ref)}`
    : null;

  return (
    <article className="group relative flex flex-col overflow-hidden border border-[--color-rule] bg-[--color-surface-raised] transition-colors hover:border-[--color-signal-soft]">
      <div className="relative">
        <Link
          href={viewerHref}
          prefetch
          className="block focus:outline-none"
          aria-label={`Verify ${record.name}`}
        >
          <CardThumbnail
            bundleHash={record.bundleHash}
            contentRef={record.content?.ref ?? null}
            label={record.labelName}
          />
        </Link>

        {sceneUrl && <CardScene url={sceneUrl} detailHref={viewerHref} />}

        {/* Top-right pills: mode + token (sit above CardScene's play button) */}
        <div className="pointer-events-none absolute right-3 top-3 z-30 flex flex-col items-end gap-2">
          {record.mode && (
            <span className="rounded-full border border-[--color-rule] bg-[--color-surface-deep]/85 px-2 py-1 text-mono-xs uppercase tracking-[0.14em] text-[--color-ink-mute] backdrop-blur">
              {record.mode}
            </span>
          )}
          {record.tokenId !== null && (
            <span className="rounded-full border border-[--color-signal-soft] bg-[--color-surface-deep]/85 px-2 py-1 text-mono-xs text-[--color-signal] backdrop-blur">
              #{record.tokenId.toString()}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <Link
            href={viewerHref}
            prefetch
            className="min-w-0 flex-1 text-h2 text-[--color-ink] underline decoration-transparent underline-offset-4 transition-colors hover:decoration-[--color-signal] focus:outline-none"
          >
            <span className="block truncate">{record.labelName}</span>
          </Link>
          <Eyebrow className="shrink-0">{captureLabel}</Eyebrow>
        </div>

        <p className="text-mono-s text-[--color-ink-mute]">
          <span className="opacity-70">.{record.name.replace(record.labelName + ".", "")}</span>
        </p>

        {record.description && (
          <p className="line-clamp-2 text-body-s text-[--color-ink-mute]">
            {record.description}
          </p>
        )}

        <dl className="mt-auto grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 pt-2">
          {record.bundleHash && (
            <>
              <dt className="text-mono-xs text-[--color-ink-faint]">bundle</dt>
              <dd>
                <Mono className="text-mono-xs" title={record.bundleHash}>
                  {shortHex(record.bundleHash, 6, 6)}
                </Mono>
              </dd>
            </>
          )}
          {record.attestor && (
            <>
              <dt className="text-mono-xs text-[--color-ink-faint]">attestor</dt>
              <dd>
                <Mono className="text-mono-xs" title={record.attestor}>
                  {shortAddress(record.attestor)}
                </Mono>
              </dd>
            </>
          )}
          {record.content && (
            <>
              <dt className="text-mono-xs text-[--color-ink-faint]">{record.content.protocol}</dt>
              <dd>
                <a
                  href={contentDirectUrl(record.content)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-mono-xs text-[--color-ink] underline decoration-transparent underline-offset-4 transition-colors hover:decoration-[--color-signal] hover:text-[--color-signal]"
                  title={record.content.ref}
                >
                  {shortHex(record.content.ref, 6, 6)} ↗
                </a>
              </dd>
            </>
          )}
        </dl>

        <div className="flex items-center justify-between gap-3 border-t border-[--color-rule] pt-3 text-mono-xs">
          <Link
            href={viewerHref}
            prefetch
            className="text-[--color-signal] underline decoration-transparent underline-offset-4 transition-colors hover:decoration-[--color-signal]"
          >
            verify ↗
          </Link>
          <a
            href={ensAppForName(record.name)}
            target="_blank"
            rel="noreferrer"
            className="text-[--color-ink-mute] transition-colors hover:text-[--color-ink]"
          >
            ens ↗
          </a>
        </div>
      </div>
    </article>
  );
}

function formatCapture(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  const now = Date.now();
  const ageMs = now - d.getTime();
  const day = 86_400_000;
  if (ageMs < day) return "today";
  if (ageMs < 2 * day) return "yesterday";
  if (ageMs < 7 * day) return `${Math.floor(ageMs / day)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
