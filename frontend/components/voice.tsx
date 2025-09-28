/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { SpeechStream } from "@/lib/speechStream";
import { cn } from "@/lib/utils";
import { transcriptWs } from "@/lib/wsClient";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ArrowRightToLine, Download, Mic, Trash } from "lucide-react";
import Image from "next/image";
import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  className?: string;
  timerClassName?: string;
  roomId?: string;
  apiBase?: string;
};

type Record = {
  id: number;
  name: string;
  file: unknown;
};

let timerTimeout: NodeJS.Timeout;

// Utility function to pad a number with leading zeros
const padWithLeadingZeros = (num: number, length: number): string => {
  return String(num).padStart(length, "0");
};

//

export const AudioRecorderWithVisualizer = ({
  className,
  timerClassName,
  roomId,
  apiBase,
}: Props) => {
  const dbg = (...args: any[]) => {
    try {
      console.log("[voice]", ...args);
    } catch {}
  };
  // States
  const [isRecording, setIsRecording] = useState<boolean>(false);
  // const [, setIsRecordingFinished] = useState<boolean>(false);
  const [timer, setTimer] = useState<number>(0);
  const [currentRecord, setCurrentRecord] = useState<Record>({
    id: -1,
    name: "",
    file: null,
  });
  // Calculate the hours, minutes, and seconds from the timer
  const hours = Math.floor(timer / 3600);
  const minutes = Math.floor((timer % 3600) / 60);
  const seconds = timer % 60;

  // Split the hours, minutes, and seconds into individual digits
  const [hourLeft, hourRight] = useMemo(
    () => padWithLeadingZeros(hours, 2).split(""),
    [hours]
  );
  const [minuteLeft, minuteRight] = useMemo(
    () => padWithLeadingZeros(minutes, 2).split(""),
    [minutes]
  );
  const [secondLeft, secondRight] = useMemo(
    () => padWithLeadingZeros(seconds, 2).split(""),
    [seconds]
  );
  // Refs
  const mediaRecorderRef = useRef<{
    stream: MediaStream | null;
    analyser: AnalyserNode | null;
    mediaRecorder: MediaRecorder | null;
    audioContext: AudioContext | null;
  }>({
    stream: null,
    analyser: null,
    mediaRecorder: null,
    audioContext: null,
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<any>(null);
  const speechRef = useRef<SpeechStream | null>(null);
  const [finalText, setFinalText] = useState<string>("");
  const [interimText, setInterimText] = useState<string>("");
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [isOlgaVisible, setIsOlgaVisible] = useState<boolean>(false);
  const olgaTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [uiPhase, setUiPhase] = useState<"idle" | "recording" | "final">(
    "idle"
  );

  async function ensureTranscriptWs() {
    if (!roomId) return;
    if (transcriptWs.isConnected()) return;
    try {
      await transcriptWs.connect(roomId);
      dbg("transcript WS connected", { roomId });
    } catch (e) {
      dbg("transcript WS connect error", e);
    }
  }

  function startRecording() {
    dbg("startRecording called", {
      roomId,
      apiBase,
      hasDGKey: Boolean(process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY),
    });
    const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY as string;
    if (!apiKey) {
      dbg("NEXT_PUBLIC_DEEPGRAM_API_KEY is not set");
      return;
    }

    const speech = new SpeechStream({
      apiKey,
      onOpen: () => dbg("deepgram live open"),
      onClose: () => dbg("deepgram live close"),
      onSpeechStarted: async (_ts, payload) => {
        dbg("SpeechStarted", { payload });
        await ensureTranscriptWs();
        transcriptWs.sendDGSpeechStarted(payload);
      },
      onUtteranceEnd: async (_ts, payload) => {
        dbg("UtteranceEnd", { payload });
        await ensureTranscriptWs();
        transcriptWs.sendDGUtteranceEnd(payload);
      },
      onTranscript: async (text, isFinal, payload) => {
        dbg("Trasncript", { text, payload, isFinal });

        if (!isFinal) {
          setInterimText(text);
        } else {
          if (text.length > 0) {
            setFinalText((prev) => (prev ? `${prev} ${text}` : text));
            await ensureTranscriptWs();
            transcriptWs.sendDGTranscript(payload, text);
          }
          setInterimText("");
        }
      },
    });

    speech
      .start()
      .then(() => {
        setIsRecording(true);
        setUiPhase("recording");
        ensureTranscriptWs();
        mediaRecorderRef.current = {
          stream: speech.getStream(),
          analyser: speech.getAnalyser(),
          mediaRecorder: null,
          audioContext: null,
        };

        // Schedule avatar pop-in 2s after recording starts
        try {
          setIsOlgaVisible(false);
          if (olgaTimeoutRef.current) clearTimeout(olgaTimeoutRef.current);
          olgaTimeoutRef.current = setTimeout(() => {
            setIsOlgaVisible(true);
          }, 2000);
        } catch {}
      })
      .catch((error) => {
        try {
          alert(error);
        } catch {}
        dbg("getUserMedia/stream start error", error);
      });

    speechRef.current = speech;
  }
  // Effect to update the timer every second
  useEffect(() => {
    if (isRecording) {
      timerTimeout = setTimeout(() => {
        setTimer(timer + 1);
      }, 1000);
    }
    return () => clearTimeout(timerTimeout);
  }, [isRecording, timer]);

  // Visualizer
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext("2d");
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    const drawWaveform = (dataArray: Uint8Array) => {
      if (!canvasCtx) return;
      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
      canvasCtx.fillStyle = "#939393";

      const barWidth = 1;
      const spacing = 1;
      const maxBarHeight = HEIGHT / 2.5;
      const numBars = Math.floor(WIDTH / (barWidth + spacing));

      for (let i = 0; i < numBars; i++) {
        const barHeight = Math.pow(dataArray[i] / 128.0, 8) * maxBarHeight;
        const x = (barWidth + spacing) * i;
        const y = HEIGHT / 2 - barHeight / 2;
        canvasCtx.fillRect(x, y, barWidth, barHeight);
      }
    };

    const visualizeVolume = () => {
      if (
        !mediaRecorderRef.current?.stream?.getAudioTracks()[0]?.getSettings()
          .sampleRate
      )
        return;
      const bufferLength =
        (mediaRecorderRef.current?.stream?.getAudioTracks()[0]?.getSettings()
          .sampleRate as number) / 100;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!isRecording) {
          cancelAnimationFrame(animationRef.current || 0);
          return;
        }
        animationRef.current = requestAnimationFrame(draw);
        mediaRecorderRef.current?.analyser?.getByteTimeDomainData(dataArray);
        drawWaveform(dataArray);
      };

      draw();
    };

    if (isRecording) {
      visualizeVolume();
    } else {
      cancelAnimationFrame(animationRef.current || 0);
    }

    return () => {
      cancelAnimationFrame(animationRef.current || 0);
    };
  }, [isRecording]);

  // Auto-follow transcript scroll (horizontal)
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, [finalText, interimText]);

  // Removed manual transcript download in favor of server-side feedback upload

  const downloadCurrentAudio = () => {
    speechRef.current?.downloadCurrentAudio();
  };

  function resetRecording() {
    dbg("resetRecording called");
    // Soft reset: keep recording session alive, just clear buffers and UI state
    try {
      speechRef.current?.clearBuffers?.();
    } catch {}
    setTimer(0);
    clearTimeout(timerTimeout);

    // Clear the animation frame and canvas content
    // cancelAnimationFrame(animationRef.current || 0);
    // const canvas = canvasRef.current;
    // if (canvas) {
    //   const canvasCtx = canvas.getContext("2d");
    //   if (canvasCtx) {
    //     const WIDTH = canvas.width;
    //     const HEIGHT = canvas.height;
    //     canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
    //   }
    // }

    // Clear current record and transcript text
    try {
      if (typeof currentRecord.file === "string") {
        URL.revokeObjectURL(currentRecord.file as string);
      }
    } catch {}
    setCurrentRecord({ id: -1, name: "", file: null });
    setFinalText("");
    setInterimText("");
  }

  // Clear only current buffers and texts without stopping recording
  // Removed clearCurrent button usage; session ends via finalize upload

  return (
    <div className={cn("w-full relative", className)}>
      <LayoutGroup id="voice-cta-group">
        {/* Centered CTA visible when not in recording phase (idle/final) */}
        <AnimatePresence initial={false} mode="popLayout">
          {uiPhase !== "recording" ? (
            <motion.div
              className="absolute inset-0 z-10 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="relative flex items-center gap-3 z-10">
                <motion.button
                  layout
                  layoutId="big-cta"
                  onClick={() => {
                    if (uiPhase === "idle") startRecording();
                  }}
                  className="inline-flex min-h-[6rem] min-w-28 px-7 items-center justify-center gap-2 rounded-xl border-2 border-foreground/20 text-card-foreground shadow-xl ring-1 ring-black/5 hover:shadow-xl transition-transform duration-150 ease-out hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  style={{ backgroundColor: "oklch(0.216 0.006 56.043)" }}
                  initial={{ scale: 1 }}
                  animate={{ scale: 1 }}
                  whileHover={{ scale: 1.03 }}
                  transition={{
                    type: "tween",
                    duration: 0.15,
                    ease: "easeOut",
                  }}
                >
                  <Mic size={28} />
                </motion.button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="w-full grid grid-cols-[1fr_auto] grid-rows-[auto_auto] gap-2">
          <div className="w-full grid grid-cols-[auto_1fr] items-center gap-2">
            <div className="flex gap-2">
              {uiPhase === "recording" ? (
                <button
                  onClick={resetRecording}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-md border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground"
                  title="Reset recording"
                >
                  <Trash size={16} />
                </button>
              ) : null}

              {uiPhase === "recording" ? (
                <button
                  onClick={downloadCurrentAudio}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-md border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground"
                  title="Download audio"
                >
                  <Download size={16} />
                </button>
              ) : null}
            </div>

            <motion.div
              className={cn(
                "flex items-center gap-2 min-w-0",
                uiPhase !== "recording" && "pointer-events-none"
              )}
              initial={false}
              animate={{ opacity: uiPhase === "recording" ? 1 : 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {uiPhase === "recording" ? (
                <Timer
                  hourLeft={hourLeft}
                  hourRight={hourRight}
                  minuteLeft={minuteLeft}
                  minuteRight={minuteRight}
                  secondLeft={secondLeft}
                  secondRight={secondRight}
                  timerClassName={cn("h-12", timerClassName)}
                />
              ) : null}
              <canvas
                ref={canvasRef}
                className="h-12 w-full bg-background border rounded-md"
              />
            </motion.div>
          </div>

          {uiPhase === "recording" ? (
            <div className="row-span-2 relative flex items-stretch rounded-lg overflow-visible">
              <motion.div
                className="absolute z-0 -right-13 top-1 rotate-[45deg] pointer-events-none select-none"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{
                  opacity: isOlgaVisible ? 1 : 0,
                  scale: isOlgaVisible ? 1 : 0.8,
                }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <Image
                  src="/avatars/olga-noback.jpeg"
                  alt="Olga"
                  className="opacity-70"
                  width={90}
                  height={90}
                />
              </motion.div>
              <motion.button
                layout
                layoutId="big-cta"
                onClick={() => {
                  (async () => {
                    try {
                      // Disconnect live transcript WS
                      try {
                        transcriptWs.disconnect();
                      } catch {}
                      // Stop recording stream
                      const wav = speechRef.current?.getCurrentAudioBlob();
                      setIsRecording(false);
                      setUiPhase("idle");
                      setIsOlgaVisible(false);
                      if (olgaTimeoutRef.current)
                        clearTimeout(olgaTimeoutRef.current);
                      try {
                        speechRef.current?.stop();
                      } catch {}
                      // Upload WAV to backend feedback endpoint
                      if (wav && apiBase && roomId) {
                        const form = new FormData();
                        form.append("audio", wav, `Audio_${Date.now()}.wav`);
                        const res = await fetch(
                          `${apiBase}/rooms/${roomId}/feedback`,
                          {
                            method: "POST",
                            body: form,
                          }
                        );
                        const json = await res.json().catch(() => ({}));
                        console.log("/feedback response", res.status, json);
                      }
                    } catch (e) {
                      console.log("finalize error", e);
                    }
                  })();
                }}
                className="relative shadow-md shadow-black z-10 inline-flex h-full min-h-[6rem] w-28 items-center justify-center rounded-lg border  text-card-foreground hover:bg-accent hover:text-accent-foreground"
                style={{ backgroundColor: "oklch(0.216 0.006 56.043)" }}
                title="Clear current audio and transcript"
                initial={{ scale: 1 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "tween", duration: 0.15, ease: "easeOut" }}
              >
                <ArrowRightToLine size={40} />
              </motion.button>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-end gap-2 min-w-0">
            <motion.div
              ref={transcriptRef as any}
              className={cn(
                "rounded-md border bg-background text-lg leading-relaxed text-foreground h-12 w-full overflow-x-auto overflow-y-hidden flex items-center px-3 min-w-0",
                uiPhase !== "recording" && "pointer-events-none"
              )}
              initial={false}
              animate={{ opacity: uiPhase === "recording" ? 1 : 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <span className="whitespace-nowrap">{finalText} </span>
              <span className="opacity-60 whitespace-nowrap">
                {interimText}
              </span>
            </motion.div>
          </div>
        </div>
      </LayoutGroup>
    </div>
  );
};

const Timer = React.memo(
  ({
    hourLeft,
    hourRight,
    minuteLeft,
    minuteRight,
    secondLeft,
    secondRight,
    timerClassName,
  }: {
    hourLeft: string;
    hourRight: string;
    minuteLeft: string;
    minuteRight: string;
    secondLeft: string;
    secondRight: string;
    timerClassName?: string;
  }) => {
    return (
      <div
        className={cn(
          "items-center justify-center gap-0.5 border p-1.5 rounded-md font-mono font-medium text-foreground flex",
          timerClassName
        )}
      >
        <span className="rounded-md bg-background p-0.5 text-foreground">
          {hourLeft}
        </span>
        <span className="rounded-md bg-background p-0.5 text-foreground">
          {hourRight}
        </span>
        <span>:</span>
        <span className="rounded-md bg-background p-0.5 text-foreground">
          {minuteLeft}
        </span>
        <span className="rounded-md bg-background p-0.5 text-foreground">
          {minuteRight}
        </span>
        <span>:</span>
        <span className="rounded-md bg-background p-0.5 text-foreground">
          {secondLeft}
        </span>
        <span className="rounded-md bg-background p-0.5 text-foreground ">
          {secondRight}
        </span>
      </div>
    );
  }
);
Timer.displayName = "Timer";
