"use client";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 max-w-xl p-4 mt-14">
        <a
          href="/staging"
          className="rounded-lg border bg-card text-card-foreground px-4 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          Staging
        </a>
        <a
          href="/report"
          className="rounded-lg border bg-card text-card-foreground px-4 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          Final Report
        </a>
      </div>
    </main>
  );
}
