"use client";
type Feedback = {
  fillerWords: {
    totalWords: number;
    fillerCount: number;
    fillerPercent: number;
  };
  durationVsGoal: {
    actualSeconds: number;
    goalSeconds: number;
    deviationSeconds: number;
    actualFormatted: string;
    goalFormatted: string;
  };
  speechRate: {
    avgWpm: number;
    minWpm: number;
    maxWpm: number;
    optimalRange: { min: number; max: number };
    status: string;
  };
  upsides: string[];
  shortcomings: string[];
  topics: string[];
};
//

import type { Metric } from "@/components/ui/activity-card";
import { ActivityCard } from "@/components/ui/activity-card";
//
import { CardSticky, ContainerScroll } from "@/components/cards-stack";
import { Spotlight } from "@/components/ui/spotlight-new";
import { ActivityIcon, AlertTriangle, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function ReportPage() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("podium_feedback");
      if (raw) setFeedback(JSON.parse(raw));
    } catch {}
  }, []);

  const fillerPercent = feedback?.fillerWords?.fillerPercent ?? 0;
  const fillerCount = feedback?.fillerWords?.fillerCount ?? 0;
  const totalWords = feedback?.fillerWords?.totalWords ?? 0;

  const filler = {
    percentage: fillerPercent,
    fillerCount,
    totalWords,
    severity: fillerPercent < 15 ? "good" : fillerPercent < 25 ? "warn" : "bad",
  } as {
    percentage: number;
    fillerCount: number;
    totalWords: number;
    severity: string;
  };

  const actualSeconds = feedback?.durationVsGoal?.actualSeconds ?? 0;
  const goalSeconds = feedback?.durationVsGoal?.goalSeconds ?? 0;
  // duration stats are computed ad-hoc in metrics; no separate gauge here

  const reportMetrics: Metric[] = (() => {
    const fillerValue = Number(filler.percentage.toFixed(1));
    const durationMinutes = actualSeconds / 60;
    const wpmAvg = Math.round(feedback?.speechRate?.avgWpm ?? 0);
    const wpmCap = 200;

    return [
      {
        label: "Filler",
        value: String(fillerValue),
        trend: Math.max(0, Math.min(100, fillerValue)),
        unit: "%",
        badge: `${filler.fillerCount} out of ${filler.totalWords}`,
      },
      {
        label: "Duration",
        value: durationMinutes.toFixed(1),
        trend:
          goalSeconds > 0
            ? Math.max(0, Math.min(100, (actualSeconds / goalSeconds) * 100))
            : 0,
        unit: "min",
        badge:
          goalSeconds > 0
            ? `${(goalSeconds / 60).toFixed(1)} min goal`
            : undefined,
      },
      {
        label: "WPM",
        value: String(wpmAvg),
        trend: Math.max(0, Math.min(100, (wpmAvg / wpmCap) * 100)),
        unit: "wpm",
        badge: "Target 130–170 WPM",
      },
    ];
  })();

  return (
    <main className="relative h-screen overflow-hidden">
      <div className="h-full w-full rounded-md bg-black/[0.96] antialiased bg-grid-white/[0.02] relative overflow-hidden">
        <Spotlight />
        <div className="p-4 max-w-7xl mx-auto relative z-10 w-full h-full">
          <div className="p-4">
            {/* Two-column layout: left empty, right report card */}
            <section className="grid gap-6 grid-cols-7 h-[calc(100vh)] overflow-x-visible">
              <div className="w-full space-y-6 col-span-3">
                <section className="flex flex-row items-start gap-3">
                  <div className="p-4 rounded-full bg-black/10">
                    <ActivityIcon className="w-10 h-10 text-destructive" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">
                      Let&apos;s talk about how you did
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      A quick snapshot of your delivery across key speaking
                      metrics.
                    </p>
                  </div>
                </section>
                <ActivityCard
                  className="md:ml-auto"
                  metrics={reportMetrics}
                  topics={feedback?.topics || []}
                  listTitle="Identified Topics"
                />
              </div>
              <div className="w-full space-y-6 col-span-4 h-full px-6 py-1 overflow-y-auto scrollbar-none">
                {/* Stacked insight cards (scrollable only when there are cards) */}
                <ContainerScroll
                  className={`z-20 space-y-5 py-6 ${
                    (feedback?.upsides || []).length +
                      (feedback?.shortcomings || []).length ===
                    0
                      ? "h-auto overflow-visible"
                      : "min-h-[300vh]"
                  }`}
                >
                  {[
                    ...(feedback?.upsides || []).map((text) => ({
                      type: "upside" as const,
                      text,
                    })),
                    ...(feedback?.shortcomings || []).map((text) => ({
                      type: "shortcoming" as const,
                      text,
                    })),
                  ].map((item, index) => (
                    <CardSticky
                      key={`${item.type}-${index}`}
                      index={index + 2}
                      className="rounded-2xl border p-6 shadow-sm backdrop-blur-md bg-zinc-900/50"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          {item.type === "upside" ? (
                            <CheckCircle2 className="w-5 h-5 text-success" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-destructive" />
                          )}
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            {item.type === "upside" ? "Upside" : "Shortcoming"}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      </div>
                      <p className="mt-4 text-lg leading-snug">{item.text}</p>
                    </CardSticky>
                  ))}

                  {/* Mascot at the end of the stack */}
                </ContainerScroll>
                <div className="absolute bottom-0 right-60  items-center gap-3 pt-12 text-right max-w-[360px]">
                  <blockquote className="text-lg tracking-wide text-white/50 italic leading-snug mb-3">
                    “The one easy way to become worth 50 percent more than you
                    are now—at least—is to hone your communication skills—both
                    written and verbal.”
                    <footer className="mt-1 text-white/60 not-italic">
                      — Warren Buffett
                    </footer>
                  </blockquote>
                  <Image
                    src="/avatars/olga-noback.jpeg"
                    alt="Olga"
                    className="opacity-90 rounded-full"
                    width={200}
                    height={200}
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
