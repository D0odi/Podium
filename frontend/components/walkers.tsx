"use client";

import type { Bot } from "@/lib/types";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

type WalkingAudienceProps = {
  bots?: Bot[];
  className?: string;
};

// --- Helpers ---
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function computeGaussianY(
  baseY: number,
  amplitude: number,
  xCentered: number,
  sigma: number
) {
  const gaussian = Math.exp(-(xCentered * xCentered) / (2 * sigma * sigma));
  return baseY - amplitude * gaussian;
}

function chunkIntoRows<T>(items: T[], capacities: number[]): T[][] {
  const rows: T[][] = [];
  let idx = 0;
  let capIndex = 0;
  while (idx < items.length) {
    const cap = capacities[Math.min(capIndex, capacities.length - 1)];
    rows.push(items.slice(idx, idx + cap));
    idx += cap;
    capIndex += 1;
  }
  return rows;
}

// --- Seating layout tuning constants ---
// Horizontal padding inside the stage container (px)
const STAGE_MARGIN_X = 100;
// Minimum distance from the top of the stage to the highest seats (px)
const STAGE_MARGIN_TOP = 40;
// Distance from the bottom of the stage to the seating baseline (px)
const STAGE_MARGIN_BOTTOM = 0;
// Controls how wide the bell curve is. Higher => wider and flatter
const BELL_SIGMA_SCALE = 0.6;
// How much to subtly lift the edges (as a fraction of amplitude)
const EDGE_LIFT_FACTOR = 0.08;
// Stable per-bot random jitter half-ranges (final jitter is ±half-range)
const JITTER_X_HALF_RANGE_PX = 10; // horizontal ±4px
const JITTER_Y_HALF_RANGE_PX = 6; // vertical ±6px
// Downward offset for entrance animation (px)
const ENTER_OFFSET_PX = 60;
// Max scale used in SeatedBot animation; used for safe clamping (not used in current clamp)
// const BOT_MAX_SCALE = 1.03;
// Toggle to show debug overlay and console output for seat layout
const DEBUG_SEAT_LAYOUT = false;

// Multi-row seating configuration
const ROW_CAPACITIES_DEFAULT = [10, 5, 3];
// Positive values move rows downward (visually lower). Recommend 80-120.
const ROW_GAP_Y_PX = 150; // vertical distance between rows
// Each deeper row increases side margins by this many pixels (squeezes the curve)
const ROW_X_MARGIN_INCREMENT = 250;

// Deterministic hash -> [0,1) for stable per-bot jitter
function hashToUnit(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  // Convert to positive 32-bit and map to [0,1)
  const unsigned = hash >>> 0;
  return (unsigned % 100000) / 100000;
}

function Walker({
  bot,
  pathWidth,
  slow,
  directionRight,
}: {
  bot: Bot;
  pathWidth: number;
  slow: boolean;
  directionRight: boolean;
}) {
  const prefersReduced = useReducedMotion();

  function generateReaction(): { emoji: string; phrase: string } {
    const emojis = ["🙂", "👍", "🤔", "👏", "😮", "😊"];
    const phrases = ["Nice", "Interesting", "Good", "Hmm", "Cool", "Great"];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    return { emoji, phrase };
  }
  const travel = Math.max(0, pathWidth - 48);
  const duration = useMemo(
    () => (slow ? 40 : 16) + Math.random() * (slow ? 25 : 12),
    [slow]
  );

  const [showSpeech, setShowSpeech] = useState(false);
  const [phrase, setPhrase] = useState<string>("");
  const [prevPhrase, setPrevPhrase] = useState<string>("");
  const [prevVisible, setPrevVisible] = useState(false);
  const showSpeechRef = useRef(showSpeech);
  const phraseRef = useRef(phrase);

  useEffect(() => {
    showSpeechRef.current = showSpeech;
  }, [showSpeech]);
  useEffect(() => {
    phraseRef.current = phrase;
  }, [phrase]);

  useEffect(() => {
    if (prefersReduced) return;
    let cancelled = false;
    let hideTimer: number | undefined;
    let showTimer: number | undefined;

    const schedule = () => {
      const delay = 6000 + Math.random() * 8000; // less frequent
      showTimer = window.setTimeout(() => {
        if (cancelled) return;
        const r = generateReaction();
        const nextPhrase = `${r.emoji} ${r.phrase}`;
        const hadActive = showSpeechRef.current && phraseRef.current;
        if (hadActive) {
          const old = phraseRef.current;
          setPrevPhrase(old);
          setPrevVisible(true);
          window.setTimeout(() => {
            setPrevVisible(false);
            window.setTimeout(() => setPrevPhrase(""), 1000);
          }, 1600);
        }
        setPhrase(nextPhrase);
        setShowSpeech(true);
        hideTimer = window.setTimeout(() => {
          if (cancelled) return;
          setShowSpeech(false);
          schedule();
        }, 4000);
      }, delay);
    };

    schedule();
    return () => {
      cancelled = true;
      if (showTimer) window.clearTimeout(showTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [prefersReduced]);

  if (prefersReduced) {
    return (
      <div className="absolute bottom-2">
        <span className="text-2xl md:text-3xl select-none">{bot.avatar}</span>
      </div>
    );
  }

  return (
    <motion.div
      className="absolute bottom-2 will-change-transform"
      initial={{ x: directionRight ? 0 : travel }}
      animate={{ x: directionRight ? [0, travel, 0] : [travel, 0, travel] }}
      transition={{ duration, repeat: Infinity, ease: "linear" }}
      style={{ transformOrigin: "center" }}
    >
      <motion.div
        animate={{ y: [0, 0, -6, 0, 0] }}
        transition={{
          duration: 3,
          repeat: Infinity,
          repeatDelay: 1.2,
          ease: "easeInOut",
        }}
        className="relative"
        style={{ willChange: "transform" }}
      >
        <span
          className="text-3xl md:text-5xl select-none inline-block leading-none"
          style={{ transform: `scaleX(${directionRight ? 1 : -1})` }}
        >
          {bot.avatar}
        </span>
        {prevPhrase ? (
          <motion.div
            initial={false}
            animate={
              prevVisible ? { opacity: 0.9, y: -2 } : { opacity: 0, y: -8 }
            }
            transition={{ duration: 1.3, ease: "easeOut" }}
            className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-md bg-card text-card-foreground border px-2 py-1 text-md whitespace-nowrap shadow z-[1]"
            style={{ willChange: "opacity, transform" }}
          >
            {prevPhrase}
          </motion.div>
        ) : null}
        <motion.div
          initial={false}
          animate={showSpeech ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-md bg-card text-card-foreground border px-2 py-1 text-md whitespace-nowrap shadow z-[2]"
          style={{ willChange: "opacity, transform" }}
        >
          {phrase}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default function WalkingAudience({
  bots = [],
  className,
}: WalkingAudienceProps) {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const slow = true;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const update = () => {
      const w = containerRef.current?.clientWidth ?? window.innerWidth;
      setWidth(w);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [mounted]);

  if (!mounted) return null; // avoid SSR/CSR mismatch

  return (
    <div
      ref={containerRef}
      className={` pointer-events-none fixed bottom-0 left-0 right-0 z-20 overflow-hidden ${
        className ?? ""
      }`}
    >
      <div className="relative h-full w-full">
        {bots.map((b, index) => (
          <Walker
            key={`${b.id}-${index}`}
            bot={b}
            pathWidth={width}
            slow={slow}
            directionRight={Math.random() < 0.5}
          />
        ))}
      </div>
    </div>
  );
}

// Walkable stage with autonomous random walking bots
export function WalkableStage({
  bots,
  className,
  reactionsByBotId,
}: {
  bots: Bot[];
  className?: string;
  reactionsByBotId?: Record<string, string | undefined>;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const probeRef = useRef<HTMLSpanElement>(null);
  const [botHalfWidth, setBotHalfWidth] = useState<number>(24);
  const [botRects, setBotRects] = useState<
    Array<{ id: string; x: number; y: number; w: number; h: number }>
  >([]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const update = () => {
      const rect = stageRef.current?.getBoundingClientRect();
      setStageSize({ width: rect?.width ?? 0, height: rect?.height ?? 0 });
      if (probeRef.current) {
        const probeRect = probeRef.current.getBoundingClientRect();
        if (probeRect.width > 0) setBotHalfWidth(probeRect.width / 2);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [mounted]);

  // Stable, per-bot small jitter so seats feel natural but consistent
  const botOffsets = useMemo(() => {
    const offsets: Record<string, { dx: number; dy: number }> = {};
    for (const bot of bots) {
      const id = bot.id;
      const ux = hashToUnit(String(id) + "_x");
      const uy = hashToUnit(String(id) + "_y");
      const dx = (ux - 0.5) * (2 * JITTER_X_HALF_RANGE_PX);
      const dy = (uy - 0.5) * (2 * JITTER_Y_HALF_RANGE_PX);
      offsets[id] = { dx, dy };
    }
    return offsets;
  }, [bots]);

  // Compute multi-row bell-curve seats
  const rowSeats = useMemo(() => {
    const w = stageSize.width;
    const h = stageSize.height;
    if (bots.length === 0 || w === 0 || h === 0)
      return [] as Array<Array<{ id: string; x: number; y: number }>>;

    const capacities = ROW_CAPACITIES_DEFAULT;
    const rows: Array<Bot[]> = chunkIntoRows(bots, capacities);
    const result: Array<Array<{ id: string; x: number; y: number }>> = [];

    const cx = w / 2;
    const baseYGlobal = h - STAGE_MARGIN_BOTTOM;
    const amplitude = Math.max(0, baseYGlobal - STAGE_MARGIN_TOP);
    const halfWidth = Math.max(1, w / 2 - STAGE_MARGIN_X);
    const sigma = halfWidth * BELL_SIGMA_SCALE;
    const edgeLift = amplitude * EDGE_LIFT_FACTOR;

    rows.forEach((rowBots, rowIndex) => {
      const yRowOffset = rowIndex * ROW_GAP_Y_PX; // positive pushes row downward
      const rowMarginX = STAGE_MARGIN_X + rowIndex * ROW_X_MARGIN_INCREMENT;

      const seatsForRow = rowBots.map((bot, i) => {
        const id = bot.id;
        const nRow = rowBots.length;
        const t = nRow === 1 ? 0.5 : i / (nRow - 1);
        const xLinear = rowMarginX + t * (w - 2 * rowMarginX);
        const dxBase = botOffsets[id]?.dx ?? 0;
        const tFromCenter = Math.abs(t - 0.5) / 0.5;
        const edgeJitterScale = 1 - 0.6 * tFromCenter;
        const dx = dxBase * Math.max(0, edgeJitterScale);
        const xUnclamped = xLinear + dx;
        const r = botRects.find((r) => r.id === id);
        const botHalf = r ? r.w / 2 : botHalfWidth;
        const minX = rowMarginX + botHalf;
        const maxX = Math.max(minX, w - rowMarginX - botHalf);
        const x = clamp(xUnclamped, minX, maxX);
        const xCentered = x - cx;
        const yRaw = computeGaussianY(baseYGlobal, amplitude, xCentered, sigma);
        const edgeFactor = Math.pow(
          Math.min(1, Math.abs(xCentered) / halfWidth),
          2
        );
        const yWithEdge = yRaw - edgeLift * edgeFactor;
        const dy = botOffsets[id]?.dy ?? 0;
        const y = clamp(
          yWithEdge + yRowOffset + dy,
          STAGE_MARGIN_TOP,
          baseYGlobal
        );
        return { id, x, y };
      });

      result.push(seatsForRow);
    });

    return result;
  }, [
    bots,
    botOffsets,
    stageSize.width,
    stageSize.height,
    botHalfWidth,
    botRects,
  ]);

  const seats = useMemo(
    () => rowSeats.flat() as Array<{ id: string; x: number; y: number }>,
    [rowSeats]
  );

  if (!mounted) return null;

  return (
    <div
      ref={stageRef}
      className={`relative w-full h-full rounded-lg border bg-card/40 overflow-hidden ${
        className ?? ""
      }`}
      aria-label="Stage"
    >
      <span
        ref={probeRef}
        className="invisible absolute pointer-events-none text-5xl md:text-6xl select-none inline-block leading-none"
        aria-hidden
      >
        😀
      </span>
      {bots.map((bot, index) => (
        <SeatedBot
          key={bot.id}
          bot={bot}
          seat={
            seats[index] || { x: stageSize.width / 2, y: stageSize.height / 2 }
          }
          centerX={stageSize.width / 2}
          delay={index * 0.25}
          reactionText={reactionsByBotId?.[bot.id]}
          halfWidth={
            (botRects.find((r) => r.id === bot.id)?.w ?? botHalfWidth * 2) / 2
          }
          onMeasured={(rect) => {
            if (!rect) return;
            setBotRects((prev) => {
              const existing = prev.find((r) => r.id === bot.id);
              const stageRect = stageRef.current?.getBoundingClientRect();
              const nextRect = {
                id: bot.id,
                x: rect.left - (stageRect?.left ?? 0),
                y: rect.top - (stageRect?.top ?? 0),
                w: rect.width,
                h: rect.height,
              };
              const epsilon = 0.5;
              if (
                existing &&
                Math.abs(existing.x - nextRect.x) < epsilon &&
                Math.abs(existing.y - nextRect.y) < epsilon &&
                Math.abs(existing.w - nextRect.w) < epsilon &&
                Math.abs(existing.h - nextRect.h) < epsilon
              ) {
                return prev;
              }
              const next = prev.filter((r) => r.id !== bot.id);
              next.push(nextRect);
              return next;
            });
          }}
        />
      ))}

      {DEBUG_SEAT_LAYOUT && botRects.length > 0 && (
        <div className="absolute left-2 top-2 z-10 text-xs bg-black/70 text-white rounded px-2 py-1 max-w-[80%] whitespace-pre overflow-auto">
          {(() => {
            const rows = rowSeats.map(
              (row) =>
                row
                  .map((s) => botRects.find((r) => r.id === s.id))
                  .filter(Boolean) as Array<{
                  id: string;
                  x: number;
                  y: number;
                  w: number;
                  h: number;
                }>
            );
            const seatMap = new Map<
              string,
              { x: number; y: number; row: number }
            >();
            rowSeats.forEach((row, ri) => {
              row.forEach((s) =>
                seatMap.set(s.id, { x: s.x, y: s.y, row: ri })
              );
            });
            const sorted = [...botRects].sort((a, b) => a.x - b.x);
            const gaps = sorted.slice(1).map((r, i) => {
              const prev = sorted[i];
              return r.x - (prev.x + prev.w);
            });
            const rightMost =
              sorted[sorted.length - 1].x + sorted[sorted.length - 1].w;
            const overflowRight = rightMost - stageSize.width;
            const leftMost = sorted[0].x;
            const overflowLeft = Math.max(
              0,
              STAGE_MARGIN_X + botHalfWidth - leftMost
            );
            const widths = sorted.map((r) => r.w.toFixed(1)).join(", ");
            const heights = sorted.map((r) => r.h.toFixed(1)).join(", ");
            const perRow = rows
              .map((list, idx) => {
                if (list.length === 0) return `row${idx}: []`;
                const l = list[0].x;
                const r = list[list.length - 1].x + list[list.length - 1].w;
                const rowGaps = list
                  .slice(1)
                  .map((rc, i) => rc.x - (list[i].x + list[i].w))
                  .map((g) => g.toFixed(1))
                  .join(", ");
                return `row${idx}: left=${l.toFixed(1)} right=${r.toFixed(
                  1
                )} gaps=[${rowGaps}]`;
              })
              .join("\n");
            const positions = bots
              .map((b, i) => {
                const r = botRects.find((br) => br.id === b.id);
                const s = seatMap.get(b.id);
                const seatStr = s
                  ? `s=(${s.x.toFixed(1)},${s.y.toFixed(1)})`
                  : "s=(na)";
                const measStr = r
                  ? `m=(${r.x.toFixed(1)},${r.y.toFixed(1)}) c=${(
                      r.x +
                      r.w / 2
                    ).toFixed(1)}`
                  : "m=(na)";
                const rowStr = s ? `row=${s.row}` : "row=na";
                return `${i}:${b.id.slice(
                  0,
                  4
                )} ${seatStr} ${measStr} ${rowStr}`;
              })
              .join(" | ");
            const summary = [
              `stageW=${stageSize.width.toFixed(
                2
              )} stageH=${stageSize.height.toFixed(
                2
              )} botHalf=${botHalfWidth.toFixed(2)}`,
              `leftMost=${leftMost.toFixed(2)} rightMost=${rightMost.toFixed(
                2
              )} overR=${overflowRight.toFixed(2)} overL=${overflowLeft.toFixed(
                2
              )}`,
              `innerLeft=${(STAGE_MARGIN_X + botHalfWidth).toFixed(
                2
              )} innerRight=${(
                stageSize.width -
                STAGE_MARGIN_X -
                botHalfWidth
              ).toFixed(2)}`,
              `gaps=[${gaps.map((g) => g.toFixed(2)).join(", ")}]`,
              `widths=[${widths}]`,
              `heights=[${heights}]`,
              perRow,
              `positions: ${positions}`,
            ];
            return summary.join("\n");
          })()}
        </div>
      )}
    </div>
  );
}

function SeatedBot({
  bot,
  seat,
  centerX,
  delay,
  reactionText,
  halfWidth,
  onMeasured,
}: {
  bot: Bot;
  seat: { x: number; y: number };
  centerX: number;
  delay: number;
  reactionText?: string;
  halfWidth?: number;
  onMeasured?: (rect: DOMRect | null) => void;
}) {
  const prefersReduced = useReducedMotion();
  const nodeRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef<((rect: DOMRect | null) => void) | null>(null);

  useEffect(() => {
    cbRef.current = onMeasured ?? null;
  }, [onMeasured]);

  useEffect(() => {
    if (!nodeRef.current) return;
    const el = nodeRef.current;
    let rafId = 0;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const cb = cbRef.current;
      if (cb) cb(rect);
    };
    rafId = window.requestAnimationFrame(measure);
    const ro = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(measure);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [seat.x, seat.y]);

  if (prefersReduced) {
    return (
      <div className="absolute" style={{ left: seat.x, top: seat.y }}>
        <span className="text-5xl md:text-6xl select-none inline-block">
          {bot.avatar}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      ref={nodeRef}
      className="absolute will-change-transform"
      initial={{
        x: centerX - (halfWidth ?? 0),
        y: seat.y + ENTER_OFFSET_PX,
        opacity: 0,
      }}
      animate={{ x: seat.x - (halfWidth ?? 0), y: seat.y, opacity: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 22, delay }}
      style={{ x: 0, y: 0, left: 0, top: 0, transformOrigin: "center" }}
      aria-label={bot.name}
    >
      <motion.div
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 2.0, repeat: Infinity, ease: "easeInOut" }}
        className="relative flex flex-col items-center gap-3"
        style={{ willChange: "transform" }}
      >
        <span className="text-5xl md:text-6xl select-none inline-block leading-none">
          {bot.avatar}
        </span>
        <span className="text-sm select-none opacity-80 tracking-wider inline-block leading-none">
          {bot.name}
        </span>
        <motion.div
          initial={false}
          animate={reactionText ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-md bg-card text-card-foreground border px-2 py-1 text-md whitespace-nowrap shadow"
          style={{ willChange: "opacity, transform" }}
        >
          {reactionText}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
