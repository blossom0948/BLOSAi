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

function loadInitialChatState(): InitialChatState {
  if (typeof window === "undefined") {
    return {
      messages: [],
      conversations: [],
      currentId: "",
      settings: DEFAULT_SETTINGS,
      memory: {},
      loggedIn: false,
    };
  }

  const savedSettings = localStorage.getItem("blos-settings");
  const settings = savedSettings
    ? { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }
    : DEFAULT_SETTINGS;

  const saved = localStorage.getItem("blos-conversations");
  const conversations: Conversation[] = saved ? JSON.parse(saved) : [];
  const firstConversation = conversations[0];
  const savedMemory = localStorage.getItem("blos-memory");
  const parsedMemory = savedMemory ? JSON.parse(savedMemory) : {};
  const memory =
    parsedMemory.name || !firstConversation
      ? parsedMemory
      : { ...parsedMemory, name: inferNameFromMessages(firstConversation.messages) || undefined };

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

      resolve({
        base64,
        type: "image/jpeg",
        previewUrl,
      });
    };

    reader.onerror = reject;
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function shouldAutoGenerateImage(message: string) {
  const text = message.toLowerCase();
  const imageWords = ["이미지", "그림", "사진", "로고", "썸네일", "포스터", "아이콘"];
  const createWords = ["만들", "생성", "그려", "제작", "create", "generate", "draw"];

  return (
    imageWords.some((word) => text.includes(word)) &&
    createWords.some((word) => text.includes(word))
  );
}

function toApiHistory(messages: Message[]) {
  return messages
    .filter((message) => message.text.trim())
    .slice(-16)
    .map((message) => ({
      role: message.role === "ai" ? ("assistant" as const) : ("user" as const),
      text: message.text,
    }));
}

function extractExplicitName(message: string) {
  const patterns = [
    /(?:내\s*이름은|제\s*이름은|나는|난|저는|전)\s*([가-힣a-zA-Z0-9\s]{2,24})(?:이야|야|입니다|이에요|예요|임|$)/i,
    /([가-힣a-zA-Z0-9\s]{2,24})(?:라고\s*불러|로\s*불러|이라고\s*불러)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return normalizeName(match[1]);
  }

  return "";
}

function isNameQuestion(message: string) {
  const text = message.replace(/\s/g, "");
  return (
    text.includes("내이름") ||
    text.includes("제이름") ||
    text.includes("이름이뭐") ||
    text.includes("이름뭐")
  );
}

function assistantAskedForName(messages: Message[]) {
  const lastAi = [...messages].reverse().find((message) => message.role === "ai");
  if (!lastAi) return false;

  return assistantTextAskedForName(lastAi.text);
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

  function login(username: string) {
    const next = {
      ...settings,
      username: username.trim() || "사용자",
    };

    setSettings(next);
    setLoggedIn(true);

    localStorage.setItem("blos-settings", JSON.stringify(next));
    localStorage.setItem("blos-logged-in", "true");
  }

  function logout() {
    setLoggedIn(false);
    localStorage.removeItem("blos-logged-in");
  }

  function updateMemory(next: UserMemory) {
    setMemory(next);
    localStorage.setItem("blos-memory", JSON.stringify(next));
  }

  function saveConversation(nextMessages: Message[]) {
    if (!settings.saveHistory) return;
    if (nextMessages.length === 0) return;

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
    window.scrollTo({ top: 0, behavior: "smooth" });
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

    const userMessage = input || "이 이미지를 분석해줘";
    const imageFile = selectedImage;

    setInput("");
    setSelectedImage(null);

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    try {
      const explicitName = extractExplicitName(userMessage);
      const bareName =
        !explicitName && assistantAskedForName(messages) && looksLikeBareName(userMessage)
          ? normalizeName(userMessage)
          : "";
      const nextName = explicitName || bareName;

      if (nextName) {
        const nextMemory = { ...memory, name: nextName };
        updateMemory(nextMemory);

        const doneMessages: Message[] = [
          ...messages,
          { role: "user", text: userMessage },
          { role: "ai", text: `${nextName}님이라고 기억할게요.` },
        ];

        setMessages(doneMessages);
        saveConversation(doneMessages);
        setLoading(false);
        return;
      }

      const inferredName = memory.name || inferNameFromMessages(messages);

      if (isNameQuestion(userMessage) && inferredName) {
        if (!memory.name) updateMemory({ ...memory, name: inferredName });

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
          {
            role: "ai",
            text: "이미지 생성 완료",
            imageUrl,
          },
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
        {
          role: "user",
          text: userMessage,
          imageUrl: previewUrl,
        },
        { role: "ai", text: "" },
      ];

      setMessages(startMessages);

      await streamChat({
        message: userMessage,
        history: toApiHistory(messages),
        memory,
        imageBase64,
        imageType,
        model: settings.model,
        signal: controller.signal,
        onChunk: (aiText) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "ai",
              text: aiText,
            };
            saveConversation(updated);
            return updated;
          });
        },
      });
    } catch (error) {
      if (controller.signal.aborted) return;

      const message =
        error instanceof Error
          ? `오류가 발생했어요.\n\n${error.message}`
          : "오류가 발생했어요. 백엔드 서버가 켜져 있는지 확인해주세요.";

      setMessages((prev) => {
        const updated = [...prev];

        if (updated.length > 0) {
          updated[updated.length - 1] = {
            role: "ai",
            text: message,
          };
        }

        saveConversation(updated);
        return updated;
      });
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
