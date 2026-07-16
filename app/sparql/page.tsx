"use client";

import { useCallback, useMemo, useState } from "react";

// Datasets the /api/sparql proxy knows how to route to. Keep the keys in sync
// with ENDPOINTS in app/api/sparql/route.ts.
const DATASETS: { key: string; label: string; description: string }[] = [
  {
    key: "network",
    label: "himiko_epigraphy",
    description: "碑文ネットワーク（人物・経歴・寄進・関係・場所・州）",
  },
  {
    key: "inscription-ref",
    label: "inscription_ref",
    description: "碑文↔文献の参照（引用文・脚注・書誌）",
  },
  {
    key: "atag",
    label: "atag_epigraphy",
    description: "ATAG 注釈付き碑文テキスト（文字・行・略号など）",
  },
  {
    key: "linking",
    label: "himiko_atag_linking",
    description: "テキスト↔ネットワークノードのリンク注釈",
  },
  {
    key: "unified",
    label: "統合ビュー",
    description:
      "4データセット横断（GRAPH <urn:unified:himiko/ref/atag/linking>）",
  },
];

// A starter query per dataset so the page is usable without knowing the schema.
const SAMPLE_QUERIES: Record<string, string> = {
  network: `# himiko_epigraphy — union-default-graph が無効なので GRAPH ?g で囲む
PREFIX epig: <http://epigraphic-careers.org/ontology#>

SELECT ?type (COUNT(*) AS ?count)
WHERE { GRAPH ?g { ?s a ?type } }
GROUP BY ?type
ORDER BY DESC(?count)
LIMIT 50`,
  "inscription-ref": `PREFIX ns: <https://example.org/inscription-ref/ns#>

SELECT ?type (COUNT(*) AS ?count)
WHERE { ?s a ?type }
GROUP BY ?type
ORDER BY DESC(?count)
LIMIT 50`,
  atag: `PREFIX p: <urn:himiko:ontology:physical:>

SELECT ?type (COUNT(*) AS ?count)
WHERE { ?s a ?type }
GROUP BY ?type
ORDER BY DESC(?count)
LIMIT 50`,
  linking: `PREFIX hmkp: <urn:himiko:ontology:physical:>

SELECT ?s ?p ?o
WHERE { ?s ?p ?o }
LIMIT 50`,
  unified: `# 統合ビュー — 4データセットを named graph として横断（SERVICE不要）
#   <urn:unified:himiko>  碑文ネットワーク（全 named graph を融合）
#   <urn:unified:ref>     碑文↔文献の参照
#   <urn:unified:atag>    注釈付きテキスト
#   <urn:unified:linking> テキスト↔ノードのリンク
# 例: 文献に多く引用されている碑文トップ20（himiko × ref を GRAPH で JOIN）
PREFIX epig: <http://epigraphic-careers.org/ontology#>
PREFIX ns:   <https://example.org/inscription-ref/ns#>
PREFIX owl:  <http://www.w3.org/2002/07/owl#>

SELECT ?edcsId (COUNT(DISTINCT ?mention) AS ?mentions)
WHERE {
  GRAPH <urn:unified:ref> {
    ?ri a ns:Inscription ; owl:sameAs ?edcs .
    ?mention ns:refersTo ?ri .
    BIND(REPLACE(STR(?edcs), "^.*p_edcs_id=", "") AS ?edcsId)
  }
  BIND(IRI(CONCAT("http://epigraphic-careers.org/inscription/", ?edcsId)) AS ?insc)
  GRAPH <urn:unified:himiko> { ?insc a epig:Inscription . }
}
GROUP BY ?edcsId
ORDER BY DESC(?mentions)
LIMIT 20`,
};

// A SPARQL SELECT-results JSON binding value.
interface SparqlValue {
  type: string;
  value: string;
  datatype?: string;
  "xml:lang"?: string;
}

interface SparqlResults {
  head?: { vars?: string[] };
  results?: { bindings?: Record<string, SparqlValue>[] };
  boolean?: boolean; // ASK queries
}

export default function SparqlPage() {
  const [dataset, setDataset] = useState<string>("network");
  const [query, setQuery] = useState<string>(SAMPLE_QUERIES.network);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SparqlResults | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const onSelectDataset = useCallback(
    (key: string) => {
      // Swap in the matching sample only if the editor still holds an untouched
      // sample from another dataset — never clobber the user's own query.
      const isSample = Object.values(SAMPLE_QUERIES).includes(query.trim());
      setDataset(key);
      if (isSample || query.trim() === "") {
        setQuery(SAMPLE_QUERIES[key] ?? "");
      }
    },
    [query],
  );

  const runQuery = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setElapsed(null);
    const startedAt = performance.now();
    try {
      const res = await fetch("/api/sparql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/sparql-results+json",
        },
        body: JSON.stringify({ query, dataset }),
      });
      const text = await res.text();
      if (!res.ok) {
        // The proxy returns JSON errors; Fuseki returns plain-text parse errors.
        let detail = text;
        try {
          const j = JSON.parse(text);
          detail = j.error ? `${j.error}${j.detail ? `: ${j.detail}` : ""}` : text;
        } catch {
          /* keep raw text */
        }
        throw new Error(`${res.status} ${res.statusText} — ${detail}`);
      }
      const data: SparqlResults = JSON.parse(text);
      setResults(data);
      setElapsed(Math.round(performance.now() - startedAt));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [query, dataset]);

  const vars = results?.head?.vars ?? [];
  const bindings = results?.results?.bindings ?? [];

  const csvHref = useMemo(() => {
    if (!bindings.length || !vars.length) return null;
    const escape = (s: string) =>
      /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const rows = [
      vars.map(escape).join(","),
      ...bindings.map((b) =>
        vars.map((v) => escape(b[v]?.value ?? "")).join(","),
      ),
    ];
    const blob = new Blob([rows.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    return URL.createObjectURL(blob);
  }, [bindings, vars]);

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-6">
          <h1 className="font-[family-name:var(--font-eb-garamond)] text-3xl font-semibold">
            SPARQL エンドポイント
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            ローマ碑文データセットに対して自由に SPARQL クエリを実行できます。
            読み取り専用（SELECT / ASK / CONSTRUCT / DESCRIBE）。
          </p>
        </header>

        {/* Dataset selector */}
        <div className="mb-4">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            データセット
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {DATASETS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => onSelectDataset(d.key)}
                className={`rounded-[var(--radius)] border px-3 py-2 text-left transition-colors ${
                  dataset === d.key
                    ? "border-[var(--primary)] bg-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)]"
                }`}
              >
                <div className="font-[family-name:var(--font-plex-mono)] text-sm font-medium">
                  {d.label}
                </div>
                <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  {d.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Query editor */}
        <div className="mb-3">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            クエリ
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Ctrl/Cmd+Enter to run.
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                runQuery();
              }
            }}
            spellCheck={false}
            rows={14}
            className="w-full resize-y rounded-[var(--radius)] border border-[var(--input)] bg-[var(--card)] p-3 font-[family-name:var(--font-plex-mono)] text-sm leading-relaxed text-[var(--foreground)] outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          />
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runQuery}
            disabled={loading || !query.trim()}
            className="rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "実行中…" : "実行 (⌘/Ctrl + Enter)"}
          </button>
          <button
            type="button"
            onClick={() => setQuery(SAMPLE_QUERIES[dataset] ?? "")}
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm hover:bg-[var(--secondary)]"
          >
            サンプルに戻す
          </button>
          {elapsed != null && (
            <span className="text-xs text-[var(--muted-foreground)]">
              {bindings.length} 件 / {elapsed} ms
            </span>
          )}
          {csvHref && (
            <a
              href={csvHref}
              download="sparql-results.csv"
              className="ml-auto text-sm text-[var(--primary)] underline"
            >
              CSV ダウンロード
            </a>
          )}
        </div>

        {/* Error */}
        {error && (
          <pre className="mb-6 overflow-auto rounded-[var(--radius)] border border-[var(--destructive)] bg-[var(--card)] p-3 text-sm text-[var(--destructive)]">
            {error}
          </pre>
        )}

        {/* Results */}
        {results && !error && (
          <div className="overflow-auto rounded-[var(--radius)] border border-[var(--border)]">
            {typeof results.boolean === "boolean" ? (
              // ASK query
              <div className="p-4 font-[family-name:var(--font-plex-mono)] text-sm">
                {String(results.boolean)}
              </div>
            ) : bindings.length === 0 ? (
              <div className="p-4 text-sm text-[var(--muted-foreground)]">
                結果は 0 件でした。
              </div>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-[var(--secondary)]">
                  <tr>
                    {vars.map((v) => (
                      <th
                        key={v}
                        className="border-b border-[var(--border)] px-3 py-2 text-left font-medium"
                      >
                        {v}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bindings.map((b, i) => (
                    <tr
                      key={i}
                      className="odd:bg-[var(--card)] even:bg-[var(--background)]"
                    >
                      {vars.map((v) => {
                        const cell = b[v];
                        const value = cell?.value ?? "";
                        const isUri = cell?.type === "uri";
                        return (
                          <td
                            key={v}
                            className="max-w-md truncate border-b border-[var(--border)] px-3 py-1.5 align-top font-[family-name:var(--font-plex-mono)] text-xs"
                            title={value}
                          >
                            {isUri ? (
                              <a
                                href={value}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--primary)] underline"
                              >
                                {value}
                              </a>
                            ) : (
                              value
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
