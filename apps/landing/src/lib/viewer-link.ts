const VIEWER_BASE = process.env.NEXT_PUBLIC_VIEWER_BASE_URL ?? "http://localhost:3000";
const SAMPLE_TOKEN = process.env.NEXT_PUBLIC_SAMPLE_TOKEN_ID;
const GITHUB = process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com";

export const viewerHome = VIEWER_BASE;
export const viewerSample = SAMPLE_TOKEN
  ? `${VIEWER_BASE}/token/${SAMPLE_TOKEN}`
  : VIEWER_BASE;
export const githubUrl = GITHUB;
export const architectureUrl = `${GITHUB}/blob/main/docs/architecture.md`;
export const trustModelUrl = `${GITHUB}/blob/main/docs/trust-model.md`;
export const hasSampleToken = Boolean(SAMPLE_TOKEN);
