import { NextRequest, NextResponse } from "next/server";

// The Fuseki endpoints live in ap-northeast-1 (Tokyo) while this function runs
// in iad1 (US East, see vercel.json): a single round-trip already costs ~150ms,
// and cold Fuseki queries can take a few seconds. Vercel's default function
// timeout (10s on some plans) can fire before the 25s proxy abort below, which
// surfaces to the client as a 504. Raise the ceiling so the proxy's own timeout
// is the one that governs. (Capped at the plan's max; Hobby allows up to 60s.)
export const maxDuration = 60;

// Server-side proxy to the Fuseki SPARQL endpoints. The endpoints are plain
// HTTP, so calling them directly from the browser would be blocked by CORS /
// mixed content on an https deployment — we proxy them here instead. The
// endpoint URLs stay server-side and are never exposed to the client.
//
// `dataset` (from the request body) selects which graph to query:
//   "network" (default) → FUSEKI_SPARQL_ENDPOINT (per-inscription network)
//   "inscription-ref"   → INSCRIPTION_REF_SPARQL_ENDPOINT (literature mentions)
//   "atag"              → ATAG_SPARQL_ENDPOINT (annotated text: ex:Text, the
//                         per-character list, and annotations — for the
//                         annotated-text pane in the network dialog)
//   "linking"           → LINKING_SPARQL_ENDPOINT (himiko_atag_linking:
//                         Annotations tying a text range to a network entity —
//                         drives the text↔node highlight in the dialog; the
//                         viewer only reads these, never writes them)
const ENDPOINTS: Record<string, string | undefined> = {
  network: process.env.FUSEKI_SPARQL_ENDPOINT,
  "inscription-ref": process.env.INSCRIPTION_REF_SPARQL_ENDPOINT,
  atag: process.env.ATAG_SPARQL_ENDPOINT,
  linking: process.env.LINKING_SPARQL_ENDPOINT,
};

export async function POST(req: NextRequest) {
  let query: string | undefined;
  let dataset = "network";
  try {
    const body = await req.json();
    query = body.query;
    if (typeof body.dataset === "string" && body.dataset in ENDPOINTS) {
      dataset = body.dataset;
    }
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "missing query" }, { status: 400 });
  }

  const ENDPOINT = ENDPOINTS[dataset];
  if (!ENDPOINT) {
    return NextResponse.json(
      { error: `SPARQL endpoint for dataset "${dataset}" is not configured` },
      { status: 503 },
    );
  }

  const form = new URLSearchParams({ query });
  const controller = new AbortController();
  // 25s: short enough to bail before browser/host kill us, long enough for
  // most reasonable Fuseki queries.
  const t = setTimeout(() => controller.abort(), 25_000);

  let upstream: Response;
  try {
    upstream = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
      },
      body: form.toString(),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(t);
    const reason = e instanceof Error ? e.message : String(e);
    const aborted =
      e instanceof Error && (e.name === "AbortError" || /abort/i.test(reason));
    return NextResponse.json(
      {
        error: aborted ? "fuseki timed out" : "fuseki unreachable",
        detail: reason,
      },
      { status: 504 },
    );
  }
  clearTimeout(t);

  const text = await upstream.text();
  if (!upstream.ok) {
    return new NextResponse(text, { status: upstream.status });
  }
  return new NextResponse(text, {
    status: 200,
    headers: { "Content-Type": "application/sparql-results+json" },
  });
}
