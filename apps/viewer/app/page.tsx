export default function HomePage() {
  return (
    <main style={{ padding: 32, maxWidth: 720 }}>
      <h1>Proof of Reality</h1>
      <p>
        A Web3 oracle for the physical world. Scan a thing with your iPhone or an
        OAK 4 D edge camera. Every Reality NFT carries three independent witnesses:
        a satellite-signed cosmic nonce, a Space Fabric KMS co-signature, and a
        hardware-rooted device signature.
      </p>
      <p>
        Open <code>/token/[id]</code> to verify a specific scan. Open{" "}
        <code>/provision</code> to register a B2B capture device.
      </p>
    </main>
  );
}
