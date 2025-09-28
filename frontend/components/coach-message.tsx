"use client";

import * as React from "react";

type CoachMessageProps = {
  paragraphs: string[];
  avatarSrc?: string;
  avatarAlt?: string;
  name?: string;
  typingDelayMs?: number;
};

export function CoachMessage({
  paragraphs,
  avatarSrc,
  avatarAlt = "Coach avatar",
  name = "Coach",
  typingDelayMs = 900,
}: CoachMessageProps) {
  const [visibleCount, setVisibleCount] = React.useState(1);

  React.useEffect(() => {
    if (!paragraphs?.length) return;
    setVisibleCount(1);
    const id = setInterval(() => {
      setVisibleCount((c) => {
        const next = c + 1;
        return next > paragraphs.length ? paragraphs.length : next;
      });
    }, typingDelayMs);
    return () => clearInterval(id);
  }, [paragraphs, typingDelayMs]);

  const shown = paragraphs?.slice(0, visibleCount) ?? [];

  return (
    <div className="flex items-start gap-3">
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-muted grid place-items-center">
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarSrc} alt={avatarAlt} className="h-full w-full object-cover" />
        ) : (
          <span className="text-base">🎤</span>
        )}
      </div>
      <div className="flex-1">
        <div className="relative rounded-2xl bg-muted px-4 py-3 text-sm leading-6">
          {/* Bubble tail */}
          <span className="absolute left-[-6px] top-4 block h-3 w-3 rotate-45 bg-muted" />
          {shown.map((p, i) => (
            <p key={i} className={i > 0 ? "mt-3" : undefined}>
              {p}
            </p>
          ))}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{name}</div>
      </div>
    </div>
  );
}


