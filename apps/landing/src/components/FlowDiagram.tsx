import { Mono } from "./Mono";

const COLS = ["Capture", "Sign", "Mint"] as const;

const ROWS = [
  {
    label: "B2C · iOS",
    sub: "RoomPlan + Object Capture + Secure Enclave",
    steps: [
      ["LiDAR + RGB scan", "ProofBundle assembled with cosmic nonce in-frame"],
      ["deviceSigningHash signed by Secure Enclave", "App Attest assertion attached"],
      ["KMS co-sign · Swarm upload · RealityProof.mint(...)"],
    ],
  },
  {
    label: "B2B · OAK 4 D",
    sub: "Luxonis camera + USB Armory Mk II (TamaGo)",
    steps: [
      ["DepthAI capture · IMU · synced timestamp", "Bundle assembled in agent"],
      ["bundleHash signed by USB Armory ECDSA", "Audit log appended"],
      ["KMS co-sign · Swarm upload · RealityProof.mint(...)"],
    ],
  },
] as const;

export function FlowDiagram() {
  return (
    <div className="container-page">
      <div className="grid grid-cols-1 md:grid-cols-12 md:gap-x-6">
        <div className="md:col-span-3" />
        {COLS.map((c, i) => (
          <div key={c} className="hidden md:col-span-3 md:block">
            <div className="text-eyebrow font-mono text-[--color-ink-mute]">
              {`0${i + 1}`} · {c.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-[--color-rule]">
        {ROWS.map((row, rowIdx) => (
          <div
            key={row.label}
            className="grid grid-cols-1 gap-x-6 border-b border-[--color-rule] py-8 md:grid-cols-12"
          >
            <div className="md:col-span-3">
              <div className="text-eyebrow font-mono text-[--color-signal]">{row.label}</div>
              <div className="mt-2 text-body-s text-[--color-ink-mute]">{row.sub}</div>
            </div>

            {row.steps.map((step, i) => (
              <div
                key={i}
                className="relative md:col-span-3"
                style={{ gridColumn: rowIdx === 0 && i === 2 ? undefined : undefined }}
              >
                <div className="md:hidden">
                  <div className="mt-6 text-eyebrow font-mono text-[--color-ink-mute]">
                    {`0${i + 1}`} · {COLS[i]?.toUpperCase()}
                  </div>
                </div>
                <ol className="mt-3 space-y-2 md:mt-0">
                  {step.map((s, j) => (
                    <li key={j} className="flex items-baseline gap-2 text-body-s text-[--color-ink]">
                      <span aria-hidden className="mt-1 block h-1.5 w-1.5 shrink-0 bg-[--color-signal]" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="md:col-span-3">
          <div className="text-eyebrow font-mono text-[--color-ink-mute]">CONVERGES AT</div>
        </div>
        <div className="md:col-span-9">
          <div className="text-h2">One backend, one contract, one proof shape.</div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-body-s">
            <Mono>RealityProof.mint(bundleHash, swarmRef, satSig, kmsSig, deviceSig, …)</Mono>
            <span className="text-[--color-ink-mute]">on Base Sepolia</span>
          </div>
        </div>
      </div>
    </div>
  );
}
