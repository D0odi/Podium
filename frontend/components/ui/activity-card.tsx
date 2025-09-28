"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowUpRight, CheckCircle2, Target } from "lucide-react";
import { useState } from "react";

// Number formatting helpers to avoid excessive trailing decimals like 13.3333333333
const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));
const formatNumber = (
  value: number | string,
  maxFractionDigits = 2
): string => {
  const num = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(num)) return String(value);
  const fixed = num.toFixed(maxFractionDigits);
  // Remove trailing zeros without using regex lookbehind for wider compatibility
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
};

export interface Metric {
  label: string;
  value: string;
  trend: number;
  unit?: string;
  badge?: string;
}

export interface Goal {
  id: string;
  title: string;
  isCompleted: boolean;
}

interface ActivityCardProps {
  metrics?: Metric[];
  dailyGoals?: Goal[];
  topics?: string[];
  listTitle?: string;
  onAddGoal?: () => void;
  onToggleGoal?: (goalId: string) => void;
  onViewDetails?: () => void;
  className?: string;
}

const METRIC_COLORS = {
  Move: "#FF2D55",
  Exercise: "#2CD758",
  Stand: "#007AFF",
} as const;

export function ActivityCard({
  metrics = [],
  dailyGoals = [],
  topics = [],
  listTitle,
  onToggleGoal,
  onViewDetails,
  className,
}: ActivityCardProps) {
  const [isHovering, setIsHovering] = useState<string | null>(null);

  const handleGoalToggle = (goalId: string) => {
    onToggleGoal?.(goalId);
  };

  return (
    <div
      className={cn(
        "relative rounded-3xl p-8",
        "bg-white dark:bg-black/5",
        "border border-zinc-200 dark:border-zinc-800",
        "hover:border-zinc-300 dark:hover:border-zinc-700",
        "transition-all duration-300",
        className
      )}
    >
      {/* Metrics Rings */}
      <div className="grid grid-cols-3 gap-4">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className="relative flex flex-col items-center"
            onMouseEnter={() => setIsHovering(metric.label)}
            onMouseLeave={() => setIsHovering(null)}
          >
            <span className="mb-4 text-base tracking-wide font-medium text-zinc-700 dark:text-zinc-300">
              {metric.label}
            </span>
            <div className="relative w-[8rem] h-[8rem]">
              <div className="absolute inset-0 rounded-full border-4 border-zinc-200 dark:border-zinc-800/50" />
              <div
                className={cn(
                  "absolute inset-0 rounded-full border-4 transition-all duration-500",
                  isHovering === metric.label && "scale-95"
                )}
                style={{
                  borderColor:
                    METRIC_COLORS[metric.label as keyof typeof METRIC_COLORS] ||
                    ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"][index % 4],
                  clipPath: (() => {
                    const pct = formatNumber(clamp(metric.trend), 2);
                    return `polygon(0 0, 100% 0, 100% ${pct}%, 0 ${pct}%)`;
                  })(),
                }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {formatNumber(metric.value)}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {metric.unit}
                </span>
              </div>
            </div>
            <Badge variant="default" className=" mt-3">
              {metric.badge}
            </Badge>
            <span className="mt-2 text-xs text-zinc-500">
              {formatNumber(clamp(metric.trend), 2)}%
            </span>
          </div>
        ))}
      </div>

      {/* List Section: Goals or Topics */}
      <div className="mt-8 space-y-6">
        <div className="h-px bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent" />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <Target className="w-4 h-4" />
              {topics.length > 0
                ? listTitle || "Identified Topics"
                : listTitle || "Today's Goals"}
            </h4>
          </div>

          <div className="space-y-2">
            {topics.length > 0
              ? topics.map((topic, idx) => (
                  <div
                    key={`${topic}-${idx}`}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl",
                      "bg-zinc-50 dark:bg-zinc-900/50",
                      "border border-zinc-200/50 dark:border-zinc-800/50",
                      "transition-all"
                    )}
                  >
                    <div className="w-2 h-2 rounded-full bg-zinc-400" />
                    <span className="text-sm text-left text-zinc-700 dark:text-zinc-300">
                      {topic}
                    </span>
                  </div>
                ))
              : dailyGoals.map((goal) => (
                  <button
                    key={goal.id}
                    onClick={() => handleGoalToggle(goal.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl",
                      "bg-zinc-50 dark:bg-zinc-900/50",
                      "border border-zinc-200/50 dark:border-zinc-800/50",
                      "hover:border-zinc-300/50 dark:hover:border-zinc-700/50",
                      "transition-all"
                    )}
                  >
                    <CheckCircle2
                      className={cn(
                        "w-5 h-5",
                        goal.isCompleted
                          ? "text-emerald-500"
                          : "text-zinc-400 dark:text-zinc-600"
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm text-left",
                        goal.isCompleted
                          ? "text-zinc-500 dark:text-zinc-400 line-through"
                          : "text-zinc-700 dark:text-zinc-300"
                      )}
                    >
                      {goal.title}
                    </span>
                  </button>
                ))}
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onViewDetails}
            className="inline-flex items-center gap-2 text-sm font-medium
              text-zinc-600 hover:text-zinc-900 
              dark:text-zinc-400 dark:hover:text-white
              transition-colors duration-200"
          >
            {"Export to CSV"}
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
