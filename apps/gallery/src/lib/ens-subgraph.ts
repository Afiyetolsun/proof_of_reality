/**
 * ENS Sepolia subgraph client. Enumerates subnames of a parent ENS
 * name (default: realityproof.eth) using the same data source the
 * official ENS app uses for its "subnames" tab.
 *
 * Why subgraph, not events:
 *   - Recovering label *strings* from on-chain `NewOwner(parent, label)`
 *     events requires a labelhash → label cache. The subgraph already
 *     maintains that cache.
 *   - User-chosen labels (vs. our deterministic vin-<hash[2:14]>) are
 *     only knowable via the subgraph (or the original mint tx).
 *
 * What this returns: minimal "subgraph view" of each subname:
 *   - name (FQDN)
 *   - labelName (just the leaf, e.g. "penguin")
 *   - createdAt (block timestamp seconds)
 *   - resolver address (we'll batch-read the rest via multicall)
 *   - contentHash bytes (already in the subgraph, save us one RPC call)
 *   - resolved address (the addr record, also in the subgraph)
 *
 * Everything else (tokenId, mode, capturedAt, bundleHash, satSig, …) is
 * a TEXT record; the subgraph stores the *keys* set on a resolver but
 * not the values, so we batch-read those via viem multicall in
 * ens-records.ts.
 */
import { namehash } from "viem";
import type { Address, Hex } from "viem";

const PARENT_NAME = process.env.NEXT_PUBLIC_ENS_PARENT_NAME ?? "realityproof.eth";
const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_ENS_SUBGRAPH_URL ??
  "https://api.studio.thegraph.com/query/49574/enssepolia/version/latest";

const PARENT_NODE = namehash(PARENT_NAME);

export interface SubgraphSubname {
  /** FQDN, e.g. "penguin.realityproof.eth" */
  name: string;
  /** Leaf label, e.g. "penguin" */
  labelName: string;
  /** Block timestamp (seconds) the subname was created. */
  createdAt: number;
  /** Resolver contract address registered for this node. */
  resolverAddress: Address | null;
  /** Decoded contenthash, if set. */
  contentHash: Hex | null;
  /** Resolved address (the `addr` record), if set. */
  resolvedAddress: Address | null;
}

const QUERY = /* GraphQL */ `
  query Subnames($parent: ID!, $first: Int!, $skip: Int!) {
    domains(
      where: { parent: $parent, name_not: null, name_not_starts_with: "[" }
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      name
      labelName
      createdAt
      resolver {
        address
        contentHash
        addr {
          id
        }
      }
    }
  }
`;

interface SubgraphResponse {
  data?: {
    domains: Array<{
      id: string;
      name: string | null;
      labelName: string | null;
      createdAt: string;
      resolver: {
        address: string;
        contentHash: string | null;
        addr: { id: string } | null;
      } | null;
    }>;
  };
  errors?: Array<{ message: string }>;
}

export async function listSubnames(
  options: { first?: number; skip?: number } = {},
): Promise<SubgraphSubname[]> {
  const first = options.first ?? 200;
  const skip = options.skip ?? 0;

  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: QUERY,
      variables: { parent: PARENT_NODE, first, skip },
    }),
    next: { revalidate: 30 },
  });

  if (!res.ok) {
    throw new Error(`ENS subgraph HTTP ${res.status}`);
  }

  const json = (await res.json()) as SubgraphResponse;
  if (json.errors?.length) {
    throw new Error(`ENS subgraph: ${json.errors.map((e) => e.message).join("; ")}`);
  }

  const rows = json.data?.domains ?? [];
  const out: SubgraphSubname[] = [];
  for (const d of rows) {
    if (!d.name || !d.labelName) continue;
    if (d.name === PARENT_NAME) continue;
    out.push({
      name: d.name,
      labelName: d.labelName,
      createdAt: Number(d.createdAt),
      resolverAddress: (d.resolver?.address as Address | undefined) ?? null,
      contentHash: (d.resolver?.contentHash as Hex | null) ?? null,
      resolvedAddress: (d.resolver?.addr?.id as Address | undefined) ?? null,
    });
  }
  return out;
}

/**
 * Map a list of subname namehashes back to their human label. Used by
 * ens-resolver.ts ONLY for user-supplied labels (default vin- labels
 * are derived locally from bundleHash). Subgraph `domains.id` is the
 * lower-case-hex namehash of the FQDN.
 */
const NODES_QUERY = /* GraphQL */ `
  query NodesById($ids: [ID!]!) {
    domains(where: { id_in: $ids }, first: 1000) {
      id
      name
      labelName
    }
  }
`;

interface NodesQueryResponse {
  data?: {
    domains: Array<{
      id: string;
      name: string | null;
      labelName: string | null;
    }>;
  };
  errors?: Array<{ message: string }>;
}

export async function lookupLabelsByNode(
  nodes: Hex[],
): Promise<Map<Hex, { name: string; labelName: string }>> {
  const out = new Map<Hex, { name: string; labelName: string }>();
  if (nodes.length === 0) return out;

  const ids = nodes.map((n) => n.toLowerCase());

  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: NODES_QUERY,
      variables: { ids },
    }),
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`ENS subgraph HTTP ${res.status}`);
  const json = (await res.json()) as NodesQueryResponse;
  if (json.errors?.length) {
    throw new Error(`ENS subgraph: ${json.errors.map((e) => e.message).join("; ")}`);
  }

  for (const d of json.data?.domains ?? []) {
    if (!d.name || !d.labelName) continue;
    out.set(d.id.toLowerCase() as Hex, { name: d.name, labelName: d.labelName });
  }
  return out;
}
