"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { generatePhotoboothStyles, type PhotoboothStyleResult } from "@/services/soraApi";

type StoredRequest = {
  imageDataUrl: string;
  styleIds: string[];
  source?: "camera" | "upload";
  createdAt?: string;
};

const STORAGE_KEY = "photobooth.request";

export default function ResultsPage() {
  const router = useRouter();
  const [requestData, setRequestData] = useState<StoredRequest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [results, setResults] = useState<PhotoboothStyleResult[]>([]);

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setError("No photo session found. Start from the home page.");
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as StoredRequest;
      if (
        !parsed ||
        typeof parsed.imageDataUrl !== "string" ||
        !Array.isArray(parsed.styleIds) ||
        !parsed.styleIds.length
      ) {
        throw new Error("Invalid stored data");
      }
      setRequestData(parsed);
    } catch {
      setError("Saved session is invalid. Please start again.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!requestData) return;

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await generatePhotoboothStyles({
          imageDataUrl: requestData.imageDataUrl,
          styleIds: requestData.styleIds,
        });
        if (!cancelled) {
          setResults(response.results ?? []);
        }
      } catch (cause) {
        if (cancelled) return;
        const message =
          cause instanceof Error && cause.message
            ? cause.message
            : "Failed to generate your photobooth styles.";
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run().catch(() => {
      if (!cancelled) {
        setLoading(false);
        setError("Unexpected error while generating styles.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [requestData]);

  const hasImages = useMemo(() => results.some((entry) => Boolean(entry.imageUrl)), [results]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push("/")}>
              <ArrowLeft data-icon="inline-start" />
              Back
            </Button>
            <h1 className="text-xl font-semibold md:text-2xl">Results</h1>
          </div>
          <Button
            onClick={() => {
              if (!requestData) return;
              setRequestData({ ...requestData });
            }}
            disabled={loading || !requestData}
          >
            Regenerate
          </Button>
        </header>

        {requestData ? (
          <section className="rounded-xl border bg-card p-4">
            <p className="mb-3 text-sm text-muted-foreground">Original photo</p>
            <img
              src={requestData.imageDataUrl}
              alt="Original"
              className="max-h-[42vh] w-full rounded-lg border object-cover"
            />
          </section>
        ) : null}

        {loading ? (
          <section className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border bg-card">
            <Loader2 className="animate-spin" />
            <p className="text-sm text-muted-foreground">Generating selected styles...</p>
          </section>
        ) : null}

        {error ? (
          <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </section>
        ) : null}

        {!loading && !error && !results.length ? (
          <section className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            No styles were returned.
          </section>
        ) : null}

        {results.length ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((item) => (
              <article key={item.styleId} className="rounded-xl border bg-card p-3">
                <p className="mb-2 text-sm font-medium">{item.label}</p>
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={`${item.label} result`}
                    className="aspect-[2/3] w-full rounded-lg border object-cover"
                  />
                ) : (
                  <div className="flex aspect-[2/3] items-center justify-center rounded-lg border bg-muted px-3 text-center text-sm text-muted-foreground">
                    {item.error ?? "Style generation failed."}
                  </div>
                )}
                {item.imageUrl ? (
                  <a
                    href={item.imageUrl}
                    download={`${item.styleId}-portrait.png`}
                    className="mt-3 inline-flex text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Download
                  </a>
                ) : null}
              </article>
            ))}
          </section>
        ) : null}

        {!loading && hasImages ? (
          <div className="pb-2">
            <Button variant="outline" className="w-full" onClick={() => router.push("/")}>
              Create another set
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
