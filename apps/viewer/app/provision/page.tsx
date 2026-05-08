"use client";

/**
 * Org-side device provisioning UI.
 *
 * Flow:
 *   1. Camera prints a QR with { devicePubKey, serial, birthNonce, vendorAttestation }
 *   2. Org admin scans QR with their wallet, opens this page
 *   3. Page shows the device info and a "Register" button
 *   4. Click → wallet signs DeviceRegistry.register(...) tx
 *
 * For the hackathon: just prefilled fields + a "Register" button.
 */
export default function ProvisionPage() {
  return (
    <main style={{ padding: 32, maxWidth: 720 }}>
      <h1>Register Capture Device</h1>
      <p>
        After scanning the camera's provisioning QR, fill the fields below and
        register the device on-chain. The org wallet you sign with becomes the
        public attestor for every scan this camera produces.
      </p>
      <form>
        <label>
          Device address:
          <input type="text" placeholder="0x…" style={{ width: "100%" }} />
        </label>
        <label>
          Birth nonce (hex):
          <input type="text" placeholder="0x…" style={{ width: "100%" }} />
        </label>
        <label>
          Label:
          <input type="text" placeholder="Prague-WH-Cam01" style={{ width: "100%" }} />
        </label>
        <button type="button" disabled>
          Register (TODO: wire wagmi)
        </button>
      </form>
    </main>
  );
}
