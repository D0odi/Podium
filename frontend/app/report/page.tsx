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

/*Format from seconds to mm:ss*/
function formatSeconds(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds)) {
    return "--:--";
  }
  const clamped = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function computeDurationStats(actualSeconds: number, goalSeconds: number) {
  const ratio = goalSeconds > 0 ? actualSeconds / goalSeconds : 0;
  const differenceSeconds = actualSeconds - goalSeconds;
  const percentDiff = goalSeconds > 0 ? (differenceSeconds / goalSeconds) * 100 : 0;
  let color: string;

  if (goalSeconds > 0) {
    if (actualSeconds < goalSeconds) {
      color = "#3b82f6"; // blue color for under the goal
    } else if (actualSeconds > goalSeconds) {
      color = "#ef4444"; // red color for over the goal
    } else {
      color = "#10b981"; // green color for on the goal
    }
  } else {
    color = "#10b981";
  }

  return {
    ratio,
    differenceSeconds,
    percentDiff,
    color,
  };
}

import { ChartRadialShape as ChartRadialShapeMetric } from "@/components/chart-radial-shape1"
import { ChartRadialShape as ChartRadialShapeDuration } from "@/components/chart-radial-shape2"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ReportPage() {
  // TODO: Replace placeholder with real transcript JSON from backend
  const sampleTranscript: TranscriptPlaceholder = {
    text:
      "Um thanks everyone for coming today. I want to, like, share a quick update on our roadmap. You know, we hit the main milestones—uh—and basically we're on track. Well, the key takeaway is that we need to focus on customer feedback.",
  };

  const filler = computeFillerStats(sampleTranscript.text);

  /*Computations for the Duration timer*/
  const sampleDuration = { actualSeconds: 350, goalSeconds: 480,};
  const duration = computeDurationStats(sampleDuration.actualSeconds, sampleDuration.goalSeconds);
  const durationEndAngle = Math.min(360, Math.max(0, duration.ratio * 360));
  
  return (
    <main className="min-h-screen p-8 space-y-8">
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
            <ChartRadialShapeMetric
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
              <CardTitle className="text-sm font-medium">Duration</CardTitle>
              <CardDescription>mm:ss</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ChartRadialShapeDuration
              value={sampleDuration.actualSeconds / 60}
              caption="Duration"
              withinCard
              title="Time Accuracy"
              description="Closer to goal is better"
              footerPrimary={`${formatSeconds(sampleDuration.actualSeconds)} actual vs ${formatSeconds(sampleDuration.goalSeconds)} goal`}
              color={duration.color}
              valueUnit=" min"
              endAngle={durationEndAngle}
            />
            <div className="mt-3 text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{formatSeconds(sampleDuration.actualSeconds)}</span> actual vs {formatSeconds(sampleDuration.goalSeconds)} goal duration
            </div>
            <p className="text-xs text-muted-foreground mt-3">See how closely you matched your target time.</p>
          </CardContent>
        </Card>


        {/* Speech Rate */}
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Speech Rate (WPM)</CardTitle>
              <CardDescription>min–avg–max</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-24 grid place-items-center text-3xl font-semibold">-- WPM</div>
            <p className="text-xs text-muted-foreground mt-3">Target 130–170 WPM for a natural pace.</p>
          </CardContent>
        </Card>      </section>
    </main>
  );
}


