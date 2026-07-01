"use client";

import { useRef, useState } from "react";
import { Conversation, Message, UserMemory, UserSettings } from "../types/chat";
import { generateImage, streamChat } from "../services/chat";

const DEFAULT_SETTINGS: UserSettings = {
  username: "사용자",
  model: "auto",
  compactMode: false,
  saveHistory: true,
};

const MEMORY_LIMIT = 36;

type InitialChatState = {
  messages: Message[];
  conversations: Conversation[];
  currentId: string;
  settings: UserSettings;
  memory: UserMemory;
  loggedIn: boolean;
};

function normalizeName(name: string) {
  return name.replace(/[^가-힣a-zA-Z0-9\s]/g, "").trim().slice(0, 24);
}

function looksLikeBareName(message: string) {
  const name = normalizeName(message);
  return name.length >= 2 && name.length <= 12 && /^[가-힣a-zA-Z0-9\s]+$/.test(name);
}

function assistantTextAskedForName(text: string) {
  const compact = text.replace(/\s/g, "");
  return (
    compact.includes("이름") &&
    (compact.includes("알려") ||
      compact.includes("말씀") ||
      compact.includes("알수없") ||
      compact.includes("모릅니다"))
  );
}

function extractExplicitName(message: string) {
  const patterns = [
    /(?:내\s*이름은|제\s*이름은|나는|저는|난)\s*([가-힣a-zA-Z0-9\s]{2,24})(?:이야|입니다|이에요|예요|야|임|$)/i,
    /([가-힣a-zA-Z0-9\s]{2,24})(?:라고\s*불러|로\s*불러|이라고\s*불러)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return normalizeName(match[1]);
  }

  return "";
}

function inferNameFromMessages(messages: Message[]) {
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role === "user") {
      const explicit = extractExplicitName(message.text);
      if (explicit) return explicit;
    }

    const next = messages[index + 1];
    if (
      message.role === "ai" &&
      next?.role === "user" &&
      assistantTextAskedForName(message.text) &&
      looksLikeBareName(next.text)
    ) {
      return normalizeName(next.text);
    }
  }

  return "";
}

function inferNameFromConversations(conversations: Conversation[]) {
  for (const conversation of conversations) {
    const name = inferNameFromMessages(conversation.messages);
    if (name) return name;
  }

  return "";
}

function isNameQuestion(message: string) {
  const text = message.replace(/\s/g, "");
  return (
    text.includes("내이름") ||
    text.includes("제이름") ||
    text.includes("이름뭐") ||
    text.includes("이름뭔")
  );
}

function assistantAskedForName(messages: Message[]) {
  const lastAi = [...messages].reverse().find((message) => message.role === "ai");
  if (!lastAi) return false;

  return assistantTextAskedForName(lastAi.text);
}

function cleanMemoryNote(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 180);
}

function shouldRememberUserMessage(message: string) {
  const text = message.trim();
  if (text.length < 4 || text.length > 220) return false;

  return /^(내|제|나는|저는|난|나의|저의)\s/.test(text) || /(기억해|기억해줘|앞으로|좋아해|싫어해|선호|이름)/.test(text);
}

function deriveMemoryFromMessage(message: string, current: UserMemory) {
  const explicitName = extractExplicitName(message);
  const note = shouldRememberUserMessage(message) ? cleanMemoryNote(message) : "";
  const notes = current.notes || [];
  const nextNotes = note && !notes.includes(note) ? [...notes, note].slice(-MEMORY_LIMIT) : notes;

  return {
    ...current,
    name: explicitName || current.name,
    notes: nextNotes,
  };
}

function hydrateMemoryFromConversations(memory: UserMemory, conversations: Conversation[]) {
  let next = { ...memory, notes: memory.notes || [] };

  if (!next.name) {
    const name = inferNameFromConversations(conversations);
    if (name) next.name = name;
  }

  for (const conversation of conversations) {
    for (const message of conversation.messages) {
      if (message.role === "user") {
        next = deriveMemoryFromMessage(message.text, next);
      }
    }
  }

  return next;
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function loadInitialChatState(): InitialChatState {
  if (typeof window === "undefined") {
    return {
      messages: [],
      conversations: [],
      currentId: "",
      settings: DEFAULT_SETTINGS,
      memory: { notes: [] },
      loggedIn: false,
    };
  }

  const settings = {
    ...DEFAULT_SETTINGS,
    ...safeJsonParse<Partial<UserSettings>>(localStorage.getItem("blos-settings"), {}),
  };
  const conversations = safeJsonParse<Conversation[]>(
    localStorage.getItem("blos-conversations"),
    []
  );
  const firstConversation = conversations[0];
  const parsedMemory = safeJsonParse<UserMemory>(localStorage.getItem("blos-memory"), {
    notes: [],
  });
  const memory = hydrateMemoryFromConversations(parsedMemory, conversations);

  localStorage.setItem("blos-memory", JSON.stringify(memory));

  return {
    messages: firstConversation?.messages || [],
    conversations,
    currentId: firstConversation?.id || "",
    settings,
    memory,
    loggedIn: localStorage.getItem("blos-logged-in") === "true",
  };
}

function compressImage(
  file: File
): Promise<{ base64: string; type: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.src = reader.result as string;
    };

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxSize = 900;
      let width = img.width;
      let height = img.height;

      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas error"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const previewUrl = canvas.toDataURL("image/jpeg", 0.75);
      const base64 = previewUrl.split(",")[1];

      resolve({ base64, type: "image/jpeg", previewUrl });
    };

    reader.onerror = reject;
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function shouldAutoGenerateImage(message: string) {
  const text = message.toLowerCase();
  const imageWords = ["이미지", "그림", "사진", "로고", "썸네일", "포스터", "아이콘", "image", "picture"];
  const createWords = ["만들", "생성", "그려", "제작", "create", "generate", "draw"];

  return (
    imageWords.some((word) => text.includes(word)) &&
    createWords.some((word) => text.includes(word))
  );
}

function toApiHistory(messages: Message[]) {
  return messages
    .filter((message) => message.text.trim())
    .slice(-24)
    .map((message) => ({
      role: message.role === "ai" ? ("assistant" as const) : ("user" as const),
      text: message.text,
    }));
}

export function useChat() {
  const initialState = useRef<InitialChatState | null>(null);
  if (!initialState.current) {
    initialState.current = loadInitialChatState();
  }

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialState.current.messages);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>(
    initialState.current.conversations
  );
  const [currentId, setCurrentId] = useState<string>(initialState.current.currentId);
  const [settings, setSettings] = useState<UserSettings>(initialState.current.settings);
  const [memory, setMemory] = useState<UserMemory>(initialState.current.memory);
  const [loggedIn, setLoggedIn] = useState(initialState.current.loggedIn);

  const abortRef = useRef<AbortController | null>(null);

  function updateSettings(next: UserSettings) {
    setSettings(next);
    localStorage.setItem("blos-settings", JSON.stringify(next));
  }

  function updateMemory(next: UserMemory) {
    const normalized = { ...next, notes: (next.notes || []).slice(-MEMORY_LIMIT) };
    setMemory(normalized);
    localStorage.setItem("blos-memory", JSON.stringify(normalized));
    return normalized;
  }

  function login(username: string) {
    const cleanName = username.trim() || "사용자";
    const next = { ...settings, username: cleanName };

    setSettings(next);
    setLoggedIn(true);
    updateMemory({ ...memory, name: cleanName });

    localStorage.setItem("blos-settings", JSON.stringify(next));
    localStorage.setItem("blos-logged-in", "true");
  }

  function logout() {
    setLoggedIn(false);
    localStorage.removeItem("blos-logged-in");
  }

  function saveConversation(nextMessages: Message[]) {
    if (!settings.saveHistory || nextMessages.length === 0) return;

    const id = currentId || crypto.randomUUID();
    const title = nextMessages[0]?.text.slice(0, 22) || "새 대화";
    const nextConversation: Conversation = {
      id,
      title,
      messages: nextMessages,
      createdAt: Date.now(),
    };
    const updated = [
      nextConversation,
      ...conversations.filter((conversation) => conversation.id !== id),
    ];

    setCurrentId(id);
    setConversations(updated);
    localStorage.setItem("blos-conversations", JSON.stringify(updated));
  }

  function newChat() {
    stopGeneration();
    setInput("");
    setMessages([]);
    setSelectedImage(null);
    setCurrentId("");
  }

  function openConversation(id: string) {
    stopGeneration();

    const found = conversations.find((conversation) => conversation.id === id);
    if (!found) return;

    setCurrentId(found.id);
    setMessages(found.messages);
    setInput("");
    setSelectedImage(null);
  }

  function deleteConversation(id: string) {
    const updated = conversations.filter((conversation) => conversation.id !== id);
    setConversations(updated);
    localStorage.setItem("blos-conversations", JSON.stringify(updated));

    if (currentId === id) {
      setCurrentId("");
      setMessages([]);
      setInput("");
      setSelectedImage(null);
    }
  }

  function clearConversations() {
    stopGeneration();
    setConversations([]);
    setCurrentId("");
    setMessages([]);
    setInput("");
    setSelectedImage(null);
    localStorage.removeItem("blos-conversations");
  }

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }

  async function sendMessage() {
    if ((!input.trim() && !selectedImage) || loading) return;

    const userMessage = input.trim() || "이 이미지를 분석해줘";
    const imageFile = selectedImage;
    const rememberedMemory = updateMemory(deriveMemoryFromMessage(userMessage, memory));

    setInput("");
    setSelectedImage(null);

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    let streamedText = "";

    try {
      const bareName =
        !extractExplicitName(userMessage) && assistantAskedForName(messages) && looksLikeBareName(userMessage)
          ? normalizeName(userMessage)
          : "";
      const nextName = extractExplicitName(userMessage) || bareName;

      if (nextName) {
        const nextMemory = updateMemory({ ...rememberedMemory, name: nextName });
        const doneMessages: Message[] = [
          ...messages,
          { role: "user", text: userMessage },
          { role: "ai", text: `${nextMemory.name}님이라고 기억할게요.` },
        ];

        setMessages(doneMessages);
        saveConversation(doneMessages);
        setLoading(false);
        return;
      }

      const inferredName = rememberedMemory.name || inferNameFromMessages(messages);

      if (isNameQuestion(userMessage) && inferredName) {
        const doneMessages: Message[] = [
          ...messages,
          { role: "user", text: userMessage },
          { role: "ai", text: `${inferredName}님입니다.` },
        ];

        setMessages(doneMessages);
        saveConversation(doneMessages);
        setLoading(false);
        return;
      }

      const shouldGenerateImage =
        !imageFile &&
        (settings.model === "image" ||
          (settings.model === "auto" && shouldAutoGenerateImage(userMessage)));

      if (shouldGenerateImage) {
        const startMessages: Message[] = [
          ...messages,
          { role: "user", text: userMessage },
          { role: "ai", text: "이미지를 생성하고 있어요..." },
        ];

        setMessages(startMessages);

        const imageUrl = await generateImage(userMessage);
        const doneMessages: Message[] = [
          ...messages,
          { role: "user", text: userMessage },
          { role: "ai", text: "이미지 생성 완료", imageUrl },
        ];

        setMessages(doneMessages);
        saveConversation(doneMessages);
        setLoading(false);
        return;
      }

      let imageBase64: string | null = null;
      let imageType: string | null = null;
      let previewUrl: string | undefined = undefined;

      if (imageFile) {
        const compressed = await compressImage(imageFile);
        imageBase64 = compressed.base64;
        imageType = compressed.type;
        previewUrl = compressed.previewUrl;
      }

      const startMessages: Message[] = [
        ...messages,
        { role: "user", text: userMessage, imageUrl: previewUrl },
        { role: "ai", text: "" },
      ];

      setMessages(startMessages);

      await streamChat({
        message: userMessage,
        history: toApiHistory(messages),
        memory: rememberedMemory,
        imageBase64,
        imageType,
        model: settings.model,
        signal: controller.signal,
        onChunk: (aiText) => {
          streamedText = aiText;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "ai", text: aiText };
            saveConversation(updated);
            return updated;
          });
        },
      });
    } catch (error) {
      if (!controller.signal.aborted && !streamedText.trim()) {
        const message =
          error instanceof Error
            ? `오류가 발생했어요.\n\n${error.message}`
            : "오류가 발생했어요. 잠시 후 다시 보내주세요.";

        setMessages((prev) => {
          const updated = [...prev];

          if (updated.length > 0) {
            updated[updated.length - 1] = { role: "ai", text: message };
          }

          saveConversation(updated);
          return updated;
        });
      }
    }

    abortRef.current = null;
    setLoading(false);
  }

  return {
    input,
    setInput,
    messages,
    loading,
    selectedImage,
    setSelectedImage,
    conversations,
    currentId,
    settings,
    updateSettings,
    loggedIn,
    login,
    logout,
    newChat,
    openConversation,
    deleteConversation,
    clearConversations,
    sendMessage,
    stopGeneration,
  };
}
