/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

export type TranscriptHandler = (
  text: string,
  isFinal: boolean,
  payload: any
) => void;

export type SpeechStartedHandler = (
  timestamp: number | null,
  payload?: any
) => void;

export type UtteranceEndHandler = (
  timestamp: number | null,
  payload?: any
) => void;

export type StreamOpenHandler = () => void;
export type StreamCloseHandler = () => void;

export type SpeechStreamOptions = {
  apiKey: string;
  sampleRate?: number;
  onTranscript?: TranscriptHandler;
  onSpeechStarted?: SpeechStartedHandler;
  onUtteranceEnd?: UtteranceEndHandler;
  onOpen?: StreamOpenHandler;
  onClose?: StreamCloseHandler;
};

export class SpeechStream {
  private options: SpeechStreamOptions;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private deepgramConn: any = null;
  private isOpen = false;
  private sessionId = 0;
  private chunks: BlobPart[] = [];
  private recorder: MediaRecorder | null = null;
  private lastUtteranceEndTsDG: number | null = null;

  constructor(options: SpeechStreamOptions) {
    this.options = options;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  async start(): Promise<void> {
    const { apiKey } = this.options;
    if (!apiKey) throw new Error("Deepgram API key not provided");

    // Request microphone access
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: this.options.sampleRate ?? 16000,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      } as MediaTrackConstraints,
    });

    // Audio graph
    let audioCtx: AudioContext;
    try {
      audioCtx = new AudioContext({
        latencyHint: "interactive",
        sampleRate: this.options.sampleRate ?? 16000,
      });
    } catch {
      audioCtx = new AudioContext();
    }
    this.audioContext = audioCtx;

    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(this.stream);
    source.connect(analyser);
    this.analyser = analyser;

    // Deepgram live
    const deepgram = createClient(apiKey);
    const dgConn = deepgram.listen.live({
      model: "nova-3",
      smart_format: true,
      interim_results: true,
      encoding: "linear16",
      filter_channels: true,
      vad_events: true,
      utterance_end_ms: 1000,
      filler_words: true,
      language: "en",
      sample_rate: audioCtx.sampleRate,
    });

    dgConn.on(LiveTranscriptionEvents.Open, () => {
      this.isOpen = true;
      this.options.onOpen?.();
    });

    dgConn.on(LiveTranscriptionEvents.Close, () => {
      this.isOpen = false;
      this.options.onClose?.();
    });

    dgConn.on(LiveTranscriptionEvents.SpeechStarted, (payload: any) => {
      const speechStartTs =
        typeof payload?.timestamp === "number" ? payload.timestamp : null;
      this.options.onSpeechStarted?.(speechStartTs, payload);
    });

    dgConn.on(LiveTranscriptionEvents.UtteranceEnd, (payload: any) => {
      const endTs =
        typeof payload?.last_word_end === "number"
          ? payload.last_word_end
          : typeof payload?.timestamp === "number"
          ? payload.timestamp
          : null;
      if (endTs != null) this.lastUtteranceEndTsDG = endTs;
      this.options.onUtteranceEnd?.(endTs, payload);
    });

    dgConn.on(LiveTranscriptionEvents.Transcript, (payload: any) => {
      const alt = payload?.channel?.alternatives?.[0];
      const text = ((alt?.transcript as string) || "").trim();
      const isFinal = Boolean((payload as any)?.is_final);
      this.options.onTranscript?.(text, isFinal, payload);
    });

    this.deepgramConn = dgConn;
    this.sessionId++;

    // AudioWorklet → send PCM frames to Deepgram
    try {
      await audioCtx.audioWorklet.addModule("/worklets/pcm-processor.js");
      const worklet = new AudioWorkletNode(audioCtx, "pcm-processor");
      source.connect(worklet);
      const volumeSink = audioCtx.createGain();
      volumeSink.gain.value = 0; // mute
      worklet.connect(volumeSink);
      volumeSink.connect(audioCtx.destination);
      worklet.port.onmessage = (event) => {
        if (!this.deepgramConn || !this.isOpen) return;
        const channelData = event.data as Float32Array;
        const ab = floatTo16BitPCM(channelData);
        try {
          this.deepgramConn.send(ab);
        } catch {
          // ignore send errors
        }
      };
    } catch {
      // no-op fallback; we rely on MediaRecorder only for download in this case
    }

    // Secondary MediaRecorder to keep downloadable chunks
    try {
      this.recorder = new MediaRecorder(this.stream);
      this.chunks = [];
      this.recorder.start(1000);
      this.recorder.ondataavailable = (e) => {
        this.chunks.push(e.data);
      };
    } catch {
      // ignore
    }
  }

  stop(): void {
    // Close Deepgram
    try {
      if (this.deepgramConn) {
        if (typeof this.deepgramConn.finish === "function")
          this.deepgramConn.finish();
        if (typeof this.deepgramConn.close === "function")
          this.deepgramConn.close();
      }
    } catch {
      // ignore
    } finally {
      this.deepgramConn = null;
      this.isOpen = false;
    }

    // Stop recording
    try {
      if (this.recorder) {
        const r = this.recorder;
        r.onstop = () => {
          this.chunks = [];
        };
        r.stop();
      }
    } catch {
      // ignore
    } finally {
      this.recorder = null;
    }

    // Stop audio graph
    try {
      if (this.analyser) this.analyser.disconnect();
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
      if (this.audioContext) this.audioContext.close();
    } catch {
      // ignore
    } finally {
      this.audioContext = null;
      this.analyser = null;
      this.stream = null;
    }
  }

  downloadCurrentAudio(filename?: string): void {
    try {
      if (this.chunks.length > 0) {
        const recordBlob = new Blob(this.chunks, { type: "audio/wav" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(recordBlob);
        a.download = filename ?? `Audio_${Date.now()}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch {
      // ignore
    }
  }

  // Return the current audio buffer as a WAV blob, without stopping the stream
  getCurrentAudioBlob(): Blob | null {
    try {
      if (this.chunks.length > 0) {
        return new Blob(this.chunks, { type: "audio/wav" });
      }
    } catch {
      // ignore
    }
    return null;
  }

  // Clear only buffered downloadable audio without stopping stream
  clearBuffers(): void {
    try {
      this.chunks = [];
      if (this.recorder && this.recorder.state === "recording") {
        try {
          this.recorder.stop();
        } catch {}
        try {
          this.recorder.start(1000);
        } catch {}
      }
    } catch {
      // ignore
    }
  }
}

// Convert Float32 PCM to 16-bit little-endian PCM ArrayBuffer
function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return buffer;
}
