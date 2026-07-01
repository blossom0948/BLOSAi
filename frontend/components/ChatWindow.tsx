"use client";

import { useEffect, useRef } from "react";
import ChatMessage from "./ChatMessage";
import Welcome from "./Welcome";
import { Message } from "../types/chat";

type Props = {
  messages: Message[];
  loading: boolean;
  onPromptSelect: (text: string) => void;
  onExport: () => void;
};

export default function ChatWindow({
  messages,
  loading,
  onPromptSelect,
  onExport,
}: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  return (
    <section className="mainArea">
      {messages.length === 0 ? (
        <Welcome onPromptSelect={onPromptSelect} />
      ) : (
        <div className="chatList">
          <div className="chatActions">
            <button onClick={onExport}>대화 저장</button>
          </div>

          {messages.map((msg, index) => (
            <ChatMessage
              key={index}
              role={msg.role}
              text={
                msg.role === "ai" && msg.text === "" && loading
                  ? "생각 중이에요..."
                  : msg.text
              }
              imageUrl={msg.imageUrl}
            />
          ))}

          <div ref={bottomRef} />
        </div>
      )}
    </section>
  );
}
