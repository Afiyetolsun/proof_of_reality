// Public URLs for the production deployment. Each can be overridden via
// NEXT_PUBLIC_* env vars (see .env.example) for previews / local dev.

const VIEWER_BASE =
  process.env.NEXT_PUBLIC_VIEWER_BASE_URL ?? "https://app.realityproof.app";
const GITHUB =
  process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/Afiyetolsun/proof_of_reality";
const ENS_APP_BASE =
  process.env.NEXT_PUBLIC_ENS_APP_BASE_URL ?? "https://sepolia.app.ens.domains";
const ENS_PARENT = process.env.NEXT_PUBLIC_ENS_PARENT_NAME ?? "realityproof.eth";

export const viewerHome = VIEWER_BASE;
export const githubUrl = GITHUB;
export const architectureUrl = `${GITHUB}/blob/main/docs/architecture.md`;
export const trustModelUrl = `${GITHUB}/blob/main/docs/trust-model.md`;
export const basescanUrl = "https://sepolia.basescan.org";
export const ensParentName = ENS_PARENT;
export const ensAppParentUrl = `${ENS_APP_BASE}/${ENS_PARENT}?tab=subnames`;
