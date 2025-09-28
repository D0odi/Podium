"use client";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
// removed slider
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Spotlight } from "@/components/ui/spotlight-new";
import { Textarea } from "@/components/ui/textarea";
import WalkingAudience from "@/components/walkers";
import { wsClient } from "@/lib/wsClient";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
const CATEGORIES = ["technical_pitch", "design_review", "fundraising"] as const;
const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  technical_pitch: "Technical Pitch",
  design_review: "Design Review",
  fundraising: "Fundraising",
};

export default function Home() {
  const router = useRouter();
  const categories = useMemo(() => CATEGORIES.slice(), []);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const loadingTimersRef = useRef<number[]>([]);
  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL as string,
    []
  );

  const form = useForm<{
    category: string;
    topic: string;
    durationMinutes: number;
  }>({
    defaultValues: {
      category: categories[0] ?? "General",
      topic: "",
      durationMinutes: 3,
    },
  });

  async function onSubmit() {
    if (busy) return;
    setBusy(true);
    // staged progress messages aligned with app purpose
    try {
      // Clear any previous timers
      loadingTimersRef.current.forEach((id) => window.clearTimeout(id));
      loadingTimersRef.current = [];
    } catch {}
    setProgress(8);
    setStatus("Preparing pitch...");
    const t1: number = window.setTimeout(() => {
      setProgress(20);
      setStatus("Seeding personas...");
    }, 2000);
    const t2: number = window.setTimeout(() => {
      setProgress(40);
      setStatus("Generating audience profiles...");
    }, 4500);
    const t3: number = window.setTimeout(() => {
      setProgress(60);
      setStatus("Warming up the stage...");
    }, 7500);
    const t4: number = window.setTimeout(() => {
      setProgress(80);
      setStatus("Dialing realtime channel...");
    }, 10000);
    const t5: number = window.setTimeout(() => {
      setProgress(95);
      setStatus("Gathering the crowd...");
    }, 13000);
    loadingTimersRef.current.push(t1, t2, t3, t4, t5);
    try {
      const res = await fetch(`${apiBase}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.getValues().category,
          topic: form.getValues().topic,
          durationMinutes: form.getValues().durationMinutes,
          durationSeconds:
            Math.max(0, Number(form.getValues().durationMinutes || 0)) * 60,
        }),
      });
      if (!res.ok) throw new Error(`create room failed ${res.status}`);
      setProgress(100);
      setStatus("Gathering the crowd...");
      try {
        loadingTimersRef.current.forEach((id) => window.clearTimeout(id));
        loadingTimersRef.current = [];
      } catch {}
      const {
        id: roomId,
        bots,
        category,
      }: {
        id: string;
        bots?: Array<{
          id: string;
          name: string;
          avatar?: string;
          persona?: { stance?: string; domain?: string };
        }>;
        category?: string;
      } = await res.json();
      // Establish WS before navigating
      await wsClient.connect(roomId);
      // Seed initial state into shared client by emitting a synthetic join for each bot
      try {
        (bots || []).forEach((b) => {
          wsClient.sendJson({ event: "join", payload: { bot: b } });
        });
      } catch {}
      // Small delay to let UI complete progress animation
      window.setTimeout(() => {
        router.push(`/scene`);
      }, 200);
    } catch {
      setBusy(false);
      setProgress(0);
      setStatus("");
      try {
        loadingTimersRef.current.forEach((id) => window.clearTimeout(id));
        loadingTimersRef.current = [];
      } catch {}
    }
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <div className="min-h-dvh w-full rounded-md flex items-center justify-center bg-black/[0.96] pb-16 antialiased bg-grid-white/[0.02] relative overflow-hidden">
        <Spotlight />
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: showForm ? 0 : 1, y: showForm ? -8 : 0 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="p-0 max-w-7xl mx-auto relative z-10 w-full"
        >
          <div className="flex items-center justify-center">
            <Image
              src="/avatars/olga-noback.jpeg"
              alt="Olga"
              className="opacity-90 rounded-full"
              width={300}
              height={300}
            />
            <div>
              <h1 className="text-4xl md:text-7xl font-bold text-left">
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
                  Bomb your{" "}
                </span>
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-blue-400 to-blue-800">
                  Pitch
                </span>
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
                  .
                  <br /> Make it unforgettable.
                </span>
              </h1>
              <p className="mt-4 font-normal text-base text-neutral-300 max-w-lg text-left">
                Seed your audience, pick a length, and start your scene.
              </p>
              <div className="mt-8 flex justify-start">
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex h-12 items-center justify-center rounded-md border bg-primary text-primary-foreground px-8 text-lg font-medium hover:opacity-90"
                >
                  Begin...🎤
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      <WalkingAudience />

      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setShowForm(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <motion.div
              key="sheet"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={() => setShowForm(false)}
            >
              <div
                className="w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="rounded-lg border bg-card text-card-foreground p-5 shadow-sm"
                  >
                    <div className="mb-4">
                      <h2 className="text-xl font-semibold tracking-tight">
                        Pitch setup
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Choose a category and length to seed your audience.
                      </p>
                    </div>

                    <div className="mb-4">
                      {" "}
                      <FormField
                        control={form.control}
                        name="durationMinutes"
                        render={({ field }) => {
                          const minutes = Number(field.value ?? 0);
                          const label = `${minutes.toString()}`;
                          return (
                            <FormItem>
                              <FormControl>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label
                                      htmlFor="durationMinutes"
                                      className="py-1"
                                    >
                                      Minutes
                                    </Label>
                                    <span className="text-sm text-muted-foreground">
                                      {label}
                                    </span>
                                  </div>
                                  <Slider
                                    id="durationMinutes"
                                    value={[minutes]}
                                    onValueChange={(vals) =>
                                      field.onChange(vals[0])
                                    }
                                    min={1}
                                    max={15}
                                    step={1}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <Label htmlFor="durationMinutes" className="py-1">
                              Category
                            </Label>
                            <FormControl>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <SelectTrigger className="w-full h-10">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories.map((c: string) => (
                                    <SelectItem key={c} value={c}>
                                      {CATEGORY_LABELS[
                                        c as (typeof CATEGORIES)[number]
                                      ] || c}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="topic"
                        render={({ field }) => (
                          <FormItem>
                            <Label htmlFor="durationMinutes" className="py-1">
                              Topic
                            </Label>
                            <FormControl>
                              <Textarea
                                className="min-h-24"
                                placeholder="e.g., Building a realtime AI presenter with WebGPU and WASM"
                                value={field.value}
                                onChange={field.onChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="mt-5">
                      {busy ? (
                        <div className="space-y-2">
                          <Progress value={progress} className="w-full" />
                          <div className="text-center">
                            <p className="text-sm mt-1 text-muted-foreground">
                              {status}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <Button type="submit" className="w-full h-12">
                          Start scene
                        </Button>
                      )}
                    </div>
                  </form>
                </Form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
