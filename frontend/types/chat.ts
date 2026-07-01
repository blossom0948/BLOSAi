export type Message = {
  role: "user" | "ai";
  text: string;
  imageUrl?: string;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
};

export type UserSettings = {
  username: string;
  model: "auto" | "minimax" | "deepseek" | "glm" | "image";
  compactMode: boolean;
  saveHistory: boolean;
};

export type UserMemory = {
  name?: string;
  notes?: string[];
};
