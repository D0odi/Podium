/* eslint-disable @typescript-eslint/no-explicit-any */
let socket: WebSocket | null = null;
let currentRoomId: string | null = null;

type MessageHandler = (data: any) => void;
const handlers = new Set<MessageHandler>();

function getWsBase(): string {
  const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL as string;
  if (!apiBase) return "";
  try {
    const url = new URL(apiBase);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.origin;
  } catch {
    return "";
  }
}

export const wsClient = {
  async connect(roomId: string): Promise<void> {
    const wsBase = getWsBase();
    if (!wsBase) throw new Error("WS base not configured");
    if (
      socket &&
      socket.readyState === WebSocket.OPEN &&
      currentRoomId === roomId
    ) {
      return;
    }
    // Close any existing
    try {
      socket?.close();
    } catch {}
    const url = `${wsBase}/ws/rooms/${roomId}`;
    socket = new WebSocket(url);
    currentRoomId = roomId;

    await new Promise<void>((resolve, reject) => {
      if (!socket) return reject(new Error("WS init failed"));
      const s = socket;
      const onOpen = () => {
        s.removeEventListener("open", onOpen);
        s.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        s.removeEventListener("open", onOpen);
        s.removeEventListener("error", onError);
        reject(new Error("WS connection error"));
      };
      s.addEventListener("open", onOpen);
      s.addEventListener("error", onError);
    });

    if (!socket) return;
    socket.onmessage = (evt) => {
      try {
        const data = JSON.parse(String(evt.data));
        handlers.forEach((h) => {
          try {
            h(data);
          } catch {}
        });
      } catch {
        // ignore malformed
      }
    };
    socket.onclose = () => {
      socket = null;
      currentRoomId = null;
    };
  },
  isConnected(): boolean {
    return Boolean(
      socket && socket.readyState === WebSocket.OPEN && currentRoomId
    );
  },
  getRoomId(): string | null {
    return currentRoomId;
  },
  getSocket(): WebSocket | null {
    return socket;
  },
  sendJson(obj: any): void {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify(obj));
    } catch {}
  },
  sendClientTranscript(text: string, meta?: any): void {
    if (!text) return;
    const payload: any = { text };
    if (meta && typeof meta === "object") payload.meta = meta;
    this.sendJson({ event: "client_transcript", payload });
  },
  subscribe(handler: MessageHandler): () => void {
    handlers.add(handler);
    return () => handlers.delete(handler);
  },
  disconnect(): void {
    try {
      socket?.close();
    } catch {}
    socket = null;
    currentRoomId = null;
  },
};
