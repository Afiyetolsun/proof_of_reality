import type { VerificationCheck } from "@/lib/verify";

interface Props {
  checks: VerificationCheck[];
}

/**
 * Renders the list of independent witness checks. Each row is one
 * cryptographic question we can answer green or red:
 *   - Did Swarm content-address the bundle? (CAC)
 *   - Did the satellite sign this nonce? (cTRNG)
 *   - Did SpaceComputer KMS co-sign the bundle hash?
 *   - Did the device's Secure Enclave sign? (App Attest / Device-SE)
 *   - Is the visible nonce inside the scene? (anti-replay)
 *   - Does it look like a real capture, not a re-photographed screen? (anti-spoof)
 */
export function Badges({ checks }: Props) {
  return (
    <ul className="badges">
      {checks.map((c) => (
        <li
          key={c.name}
          className={c.ok ? "badge badge-ok" : "badge badge-fail"}
        >
          <span className="badge-icon" aria-hidden>
            {c.ok ? "✓" : "✕"}
          </span>
          <div>
            <div className="badge-name">{c.name}</div>
            <div className="badge-detail">{c.detail}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
