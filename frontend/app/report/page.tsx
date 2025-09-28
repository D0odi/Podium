type TranscriptPlaceholder = {
  // TODO: Replace with actual backend transcript payload shape
  // e.g., { segments: Array<{ text: string; startSec: number; endSec: number }>, goalMinutes?: number }
  text: string;
};

function computeFillerStats(transcriptText: string) {
  const normalized = transcriptText.toLowerCase();
  // Grouped filler patterns; tune this list as needed
  const fillerRegex = /\b(?:um|uh|like|you\s+know|kind\s+of|sort\s+of|actually|basically|literally|i\s+mean|well|so)\b/gi;
  const fillerMatches = normalized.match(fillerRegex) ?? [];
  const fillerCount = fillerMatches.length;

  const wordMatches = normalized.match(/\b[\p{L}\p{N}']+\b/gu) ?? [];
  const totalWords = wordMatches.length;

  const percentage = totalWords > 0 ? (fillerCount / totalWords) * 100 : 0;

  // Simple visual severity for color hinting (good <15%, warn 15–<25%, bad >=25%)
  const severity = percentage < 15 ? "good" : percentage < 25 ? "warn" : "bad";

  return {
    fillerCount,
    totalWords,
    percentage,
    severity,
  };
}

import { ChartRadialShape } from "@/components/chart-radial-shape";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spotlight } from "@/components/ui/spotlight-new";
import { ChartRadialStacked } from "@/components/chart-radial-stacked";
import { CoachMessage } from "@/components/coach-message";

export default function ReportPage() {
  // TODO: Replace placeholder with real transcript JSON from backend
  const sampleTranscript: TranscriptPlaceholder = {
    text:
      "Um thanks everyone for coming today. I want to, like, share a quick update on our roadmap. You know, we hit the main milestones—uh—and basically we're on track. Well, the key takeaway is that we need to focus on customer feedback.",
  };

  const filler = computeFillerStats(sampleTranscript.text);
  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <div className="min-h-dvh w-full rounded-md bg-black/[0.96] pb-16 antialiased bg-grid-white/[0.02] relative overflow-hidden">
        <Spotlight />
        <div className="p-4 max-w-7xl mx-auto relative z-10 w-full">
          <div className="space-y-8 p-4 md:p-8">
            {/* Header */}
            <section>
              <h1 className="text-3xl font-bold tracking-tight">Let's talk about how you did</h1>
              <p className="text-sm text-muted-foreground mt-2">
                A quick snapshot of your delivery across key speaking metrics.
              </p>
            </section>
            {/* Metrics Section */}
            <section className="grid gap-6 md:grid-cols-3">
        {/* Filler Words */}
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Filler Words</CardTitle>
              <CardDescription>count / %</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ChartRadialShape
              value={Number(filler.percentage.toFixed(1))}
              caption="Filler %"
              withinCard
              title="Filler Usage"
              description="Lower is better"
              footerPrimary={`${filler.fillerCount} fillers in ${filler.totalWords} words`}
              footerSecondary="Aim for < 15%"
              color={
                filler.severity === "good"
                  ? "#10b981"
                  : filler.severity === "warn"
                  ? "#f59e0b"
                  : "#ef4444"
              }
              valueUnit="%"
              endAngle={Math.min(360, Math.max(0, filler.percentage * 3.6))}
            />
            <div className="mt-3 text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{filler.fillerCount}</span> out of {filler.totalWords} words are filler
            </div>
            <p className="text-xs text-muted-foreground mt-3">Reduce ums/ahs/likes for cleaner delivery.</p>
          </CardContent>
        </Card>

        {/* Duration Deviation */}
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Duration vs Goal</CardTitle>
              <CardDescription>mm:ss</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-24 grid place-items-center text-3xl font-semibold">--:--</div>
            <p className="text-xs text-muted-foreground mt-3">See how closely you matched your target time.</p>
          </CardContent>
        </Card>

        {/* Speech Rate */}
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Speech Rate (WPM)</CardTitle>
              <CardDescription>min-max</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {(() => {
              // TODO: Replace with backend-provided durations and per-window WPM series
              const placeholderDurationSeconds = 125;
              const placeholderWords = 280;
              const wpmAvg = Math.round((placeholderWords / (placeholderDurationSeconds / 60)) || 0);
              const wpmMin = 110; // placeholder min per sliding window
              const wpmMax = 190; // placeholder max per sliding window
              const wpmColor =
                wpmAvg < 110 || wpmAvg > 190
                  ? "#ef4444" // red
                  : wpmAvg < 130 || wpmAvg > 170
                  ? "#f59e0b" // amber
                  : "#10b981"; // green
              const wpmStatus =
                wpmAvg < 110
                  ? "Pace: too slow"
                  : wpmAvg < 130
                  ? "Pace: slightly slow"
                  : wpmAvg <= 170
                  ? "Pace: within optimal range"
                  : wpmAvg <= 190
                  ? "Pace: slightly fast"
                  : "Pace: too fast";

              return (
                <>
                  <ChartRadialStacked
                    avg={wpmAvg}
                    min={wpmMin}
                    max={wpmMax}
                    single
                    barColor={wpmColor}
                    withinCard
                    title="Speech Rate"
                    description="Average WPM vs optimal zone"
                  />
                  <p className="text-xs text-muted-foreground mt-3">{wpmStatus}</p>
                  <p className="text-xs text-muted-foreground mt-1">Target 130–170 WPM</p>
                </>
              );
            })()}
          </CardContent>
        </Card>
            </section>
            {/* Coach Feedback */}
            <section>
              <Card className="bg-transparent border-none shadow-none">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Coach Feedback</CardTitle>
                  <CardDescription>AI coach summary and suggestions</CardDescription>
                </CardHeader>
                <CardContent>
                  <CoachMessage
                    // TODO: Replace placeholder with backend-generated paragraphs
                    paragraphs={[
                      "Great job maintaining a confident tone and clear structure throughout your talk.",
                      "Try to reduce filler words and add a brief pause before key points to give them more impact.",
                      "Consider closing with a concise call-to-action to strengthen your ending.",
                    ]}
                    avatarSrc="/avatars/olga-noback.jpeg" // Place your image at frontend/public/avatars/coach.jpg
                    name="Coach"
                    typingDelayMs={1200}
                  />
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
