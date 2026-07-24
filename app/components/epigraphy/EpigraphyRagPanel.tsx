"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { queryLiteratureReferences } from "@/app/utils/sparql";
import {
  formatLiteratureForRag,
  type RefLink,
} from "@/app/lib/epigraphy/literature-rag";

// Turns the model's bare citation tokens into Markdown links before rendering:
//   [EDCS-12345678] → in-app anchor "#edcs-12345678" (handled by the renderer)
//   [REF-2]         → the external publication URL from refLinks, when known
// Unknown [REF-N] tokens (no mapping) are stripped of brackets so they don't
// render as dead links.
function linkifyAnswer(
  content: string,
  refLinks: Record<string, RefLink> | undefined,
): string {
  let out = content.replace(/\[EDCS-(\d+)\]/g, "[EDCS-$1](#edcs-$1)");
  out = out.replace(/\[REF-(\d+)\]/g, (whole, n) => {
    const link = refLinks?.[`REF-${n}`];
    return link ? `[[ref ${n}↗]](${link.url})` : "";
  });
  return out;
}

// RAG chat panel for the epigraphy app. It analyzes the inscriptions in the
// current result set (passed as `edcsIds`) via /api/rag/chat-by-edcs, and lets
// the user jump to a cited inscription via `onInscriptionClick`.

type RagModel = "gpt-4o-mini" | "gemini-2.0-flash";

interface Source {
  edcsId: string;
  placeName: string;
  score?: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  // [REF-N] token → deep link, for literature cited in this answer.
  refLinks?: Record<string, RefLink>;
}

// RAG analysis scope: the whole current result set, or just the inscription
// currently open in the detail panel.
type RagScope = "all" | "single";

type Props = {
  // EDCS ids of the current (search- and region-filtered) result set.
  edcsIds: string[];
  // The inscription currently open in the detail panel, or null. When the user
  // switches to "single" scope, RAG is restricted to this one inscription.
  selectedEdcsId?: string | null;
  // Human-readable place of the selected inscription, shown in the scope header.
  selectedPlace?: string | null;
  onInscriptionClick?: (edcsId: string) => void;
};

export default function EpigraphyRagPanel({
  edcsIds,
  selectedEdcsId,
  selectedPlace,
  onInscriptionClick,
}: Props) {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_RAG === "true";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<RagModel>("gpt-4o-mini");
  const [scope, setScope] = useState<RagScope>("all");
  // In single-inscription mode, whether to also feed the inscription's
  // scholarly literature references into the RAG context.
  const [includeLiterature, setIncludeLiterature] = useState(true);

  // The effective scope: "single" only takes effect when an inscription is
  // selected; otherwise fall back to the whole result set.
  const effectiveScope: RagScope =
    scope === "single" && selectedEdcsId ? "single" : "all";

  // The ids actually sent to RAG, depending on scope.
  const targetIds =
    effectiveScope === "single" && selectedEdcsId
      ? [selectedEdcsId]
      : edcsIds;

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Fold the inscription's scholarly literature into the RAG context when
      // the user opted in. The two scopes fetch it differently:
      //   - single mode: we fetch + format here (one known id, bounded cost)
      //     and pass the block to the server.
      //   - multi mode: the surviving inscriptions aren't known until the
      //     server runs the Pinecone top-K, so we just set the flag and let the
      //     server fetch literature for those ids (one batched SPARQL query).
      let literatureContext: string | undefined;
      let refLinks: Record<string, RefLink> | undefined;
      if (
        effectiveScope === "single" &&
        selectedEdcsId &&
        includeLiterature
      ) {
        try {
          const refs = await queryLiteratureReferences(selectedEdcsId);
          const formatted = formatLiteratureForRag(refs);
          if (formatted.context) {
            literatureContext = formatted.context;
            refLinks = formatted.refLinks;
          }
        } catch (litErr) {
          // Literature is supplementary — a failure here shouldn't block the
          // answer, so we log and proceed without it.
          console.error("literature fetch for RAG failed", litErr);
        }
      }

      const response = await fetch("/api/rag/chat-by-edcs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage,
          edcsIds: targetIds,
          model,
          literatureContext,
          refLinks,
          // In multi mode the server does the fetching; flag it so it knows to.
          includeLiterature:
            includeLiterature && effectiveScope === "all",
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to get response");
      }
      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
          refLinks: data.refLinks ?? undefined,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "An error occurred while processing your request. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleEdcsClick(edcsId: string) {
    onInscriptionClick?.(edcsId);
  }

  if (!enabled) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="max-w-sm text-center text-sm text-muted-foreground">
          <p className="mb-1 font-medium">AI analysis is disabled</p>
          <p className="text-xs">
            Set <code>NEXT_PUBLIC_ENABLE_RAG=true</code>{" "}
            in your local environment to enable it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header / scope toggle + context summary */}
      <div className="px-3 py-2 border-b border-border shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          {/* Scope toggle: whole result set vs. the selected inscription. */}
          <div className="flex gap-1 text-[11px]">
            <button
              onClick={() => setScope("all")}
              aria-pressed={effectiveScope === "all"}
              disabled={isLoading}
              className={
                "px-2 py-1 rounded border transition-colors disabled:opacity-40 " +
                (effectiveScope === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/60")
              }
            >
              Result set
            </button>
            <button
              onClick={() => setScope("single")}
              aria-pressed={effectiveScope === "single"}
              disabled={isLoading || !selectedEdcsId}
              title={
                selectedEdcsId
                  ? undefined
                  : "Select an inscription to analyze it on its own"
              }
              className={
                "px-2 py-1 rounded border transition-colors disabled:opacity-40 " +
                (effectiveScope === "single"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/60")
              }
            >
              This inscription
            </button>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              disabled={isLoading}
              className="text-xs px-2 py-1 border border-border rounded hover:bg-muted disabled:opacity-40 shrink-0"
            >
              Clear history
            </button>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {effectiveScope === "single" && selectedEdcsId ? (
            <>
              <span className="font-semibold text-foreground">
                {selectedEdcsId}
              </span>
              {selectedPlace ? ` (${selectedPlace})` : ""} analyzed on its own
            </>
          ) : (
            <>
              Analyzing the current{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {edcsIds.length}
              </span>{" "}
              result{edcsIds.length === 1 ? "" : "s"}
            </>
          )}
        </div>
        {/* Let the user fold the inscriptions' scholarly literature into the
            RAG context. In "This inscription" mode it covers the one selected
            inscription; in "Result set" mode it covers the inscriptions that
            make the top matches (fetched server-side). */}
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={includeLiterature}
            onChange={(e) => setIncludeLiterature(e.target.checked)}
            disabled={isLoading}
            className="cursor-pointer"
          />
          {effectiveScope === "single"
            ? "Include related scholarly literature in the analysis"
            : "Include related scholarly literature (for the top matches)"}
        </label>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground px-4">
            <div>
              <p className="mb-1">Ask a question about the inscriptions</p>
              <p className="text-xs text-muted-foreground">
                e.g. &ldquo;What themes do these inscriptions share?&rdquo;
              </p>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:my-2">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ node, href, children, ...props }) => {
                          const text = children?.toString() || "";
                          const match = text.match(/EDCS-(\d+)/);
                          if (
                            match &&
                            href?.startsWith("#edcs-") &&
                            onInscriptionClick
                          ) {
                            return (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleEdcsClick(`EDCS-${match[1]}`);
                                }}
                                className="text-primary underline cursor-pointer"
                              >
                                {children}
                              </button>
                            );
                          }
                          // Literature reference links open the external
                          // publication (OpenEdition) in a new tab.
                          if (href?.startsWith("http")) {
                            return (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline"
                                {...props}
                              >
                                {children}
                              </a>
                            );
                          }
                          return (
                            <a href={href} {...props}>
                              {children}
                            </a>
                          );
                        },
                      }}
                    >
                      {linkifyAnswer(m.content, m.refLinks)}
                    </ReactMarkdown>
                  </div>
                )}

                {m.role === "assistant" &&
                  m.sources &&
                  m.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-[11px] font-semibold mb-1">Cited inscriptions:</p>
                      <div className="space-y-0.5">
                        {m.sources.slice(0, 5).map((s, idx) => (
                          <div
                            key={idx}
                            className="text-[11px] text-muted-foreground"
                          >
                            ·{" "}
                            {onInscriptionClick ? (
                              <button
                                onClick={() => handleEdcsClick(s.edcsId)}
                                className="text-primary underline cursor-pointer"
                              >
                                {s.edcsId}
                              </button>
                            ) : (
                              s.edcsId
                            )}
                            {s.score != null &&
                              ` — ${(s.score * 100).toFixed(0)}%`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
                <span
                  className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span className="text-xs text-muted-foreground">Analyzing…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-border p-3 space-y-2 shrink-0"
      >
        {error && (
          <div className="text-[11px] text-destructive bg-destructive/10 rounded p-2">
            {error}
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-muted-foreground">Model:</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as RagModel)}
            disabled={isLoading}
            className="text-xs px-2 py-1 border border-border rounded bg-card disabled:opacity-50"
          >
            <option value="gpt-4o-mini">GPT-4o Mini (OpenAI)</option>
            <option value="gemini-2.0-flash">Gemini Flash (Google)</option>
          </select>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the inscriptions…"
            disabled={isLoading || targetIds.length === 0}
            className="flex-1 px-3 py-2 border border-border rounded text-sm bg-card disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim() || targetIds.length === 0}
            className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
          >
            {isLoading ? "Sending" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
