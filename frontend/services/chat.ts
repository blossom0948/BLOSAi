import { UserMemory } from "../types/chat";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type ApiHistoryItem = { role: "user" | "assistant"; text: string };

function isLocalApiUrl() {
  return API_URL.includes("127.0.0.1") || API_URL.includes("localhost");
}

function isLocalPage() {
  if (typeof window === "undefined") return true;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function shouldUseBackend() {
  return !isLocalApiUrl() || isLocalPage();
}

function buildMemoryPrompt({
  message,
  history,
  memory,
}: {
  message: string;
  history: ApiHistoryItem[];
  memory: UserMemory;
}) {
  const memoryText = [
    memory.name ? `사용자 이름: ${memory.name}` : "",
    ...(memory.notes || []).slice(-24).map((note) => `- ${note}`),
  ]
    .filter(Boolean)
    .join("\n");

  const historyText = history
    .slice(-16)
    .map((item) => `${item.role === "user" ? "사용자" : "BLOS AI"}: ${item.text}`)
    .join("\n");

  return [
    "너는 BLOS AI야. 한국어로 정확하고 자연스럽게 답해.",
    "같은 사용자 메모리와 최근 대화를 반드시 참고해. 모르면 지어내지 말고 모른다고 말해.",
    memoryText ? `[사용자 메모리]\n${memoryText}` : "",
    historyText ? `[최근 대화]\n${historyText}` : "",
    `[현재 질문]\n${message}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: init.signal || controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fallbackTextChat({
  message,
  history,
  memory,
  onChunk,
}: {
  message: string;
  history: ApiHistoryItem[];
  memory: UserMemory;
  onChunk: (text: string) => void;
}) {
  const prompt = buildMemoryPrompt({ message, history, memory });

  try {
    const res = await fetchWithTimeout(
      `https://text.pollinations.ai/${encodeURIComponent(prompt)}`,
      {},
      45000
    );

    if (!res.ok) throw new Error(`fallback status ${res.status}`);

    const text = await res.text();
    onChunk(text);
    return text;
  } catch {
    const messageText =
      "지금 모바일 네트워크에서 AI 응답 서버 연결이 불안정해요. 잠시 후 다시 보내주세요.";
    onChunk(messageText);
    return messageText;
  }
}

function pollinationsImageUrl(prompt: string) {
  const params = new URLSearchParams({
    width: "768",
    height: "768",
    model: "turbo",
    private: "true",
    nologo: "true",
    seed: String(Date.now()),
  });

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
}

export async function streamChat({
  message,
  history,
  memory,
  imageBase64,
  imageType,
  model,
  signal,
  onChunk,
}: {
  message: string;
  history: ApiHistoryItem[];
  memory: UserMemory;
  imageBase64: string | null;
  imageType: string | null;
  model: string;
  signal?: AbortSignal;
  onChunk: (text: string) => void;
}) {
  if (!shouldUseBackend()) {
    if (imageBase64) {
      const text = "배포된 모바일 웹에서는 사진 분석용 백엔드 연결이 필요합니다.";
      onChunk(text);
      return text;
    }

    return fallbackTextChat({ message, history, memory, onChunk });
  }

  let res: Response;

  try {
    res = await fetch(`${API_URL}/chat/stream`, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        history,
        memory,
        image_base64: imageBase64,
        image_type: imageType,
        model,
      }),
    });
  } catch {
    if (imageBase64) {
      const text = "이미지 분석용 백엔드 연결이 필요합니다.";
      onChunk(text);
      return text;
    }

    return fallbackTextChat({ message, history, memory, onChunk });
  }

  if (!res.ok) {
    if (!imageBase64) return fallbackTextChat({ message, history, memory, onChunk });
    throw new Error("채팅 요청에 실패했어요.");
  }

  if (!res.body) throw new Error("응답 본문이 비어 있어요.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    fullText += decoder.decode(value, { stream: true });
    onChunk(fullText);
  }

  return fullText;
}

export async function generateImage(prompt: string) {
  if (!shouldUseBackend()) return pollinationsImageUrl(prompt);

  try {
    const res = await fetch(`${API_URL}/image/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) return pollinationsImageUrl(prompt);

    const data = await res.json();
    return `data:image/png;base64,${data.image_base64}`;
  } catch {
    return pollinationsImageUrl(prompt);
  }
}
