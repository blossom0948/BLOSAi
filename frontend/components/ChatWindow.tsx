"use client";

import { useEffect, useRef } from "react";
import ChatMessage from "./ChatMessage";
import Welcome from "./Welcome";
import { Message } from "../types/chat";

type Props = {
  messages: Message[];
  loading: boolean;
  onPromptSelect: (text: string) => void;
};

export default function ChatWindow({ messages, loading, onPromptSelect }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <section className="mainArea">
      {messages.length === 0 ? (
        <Welcome onPromptSelect={onPromptSelect} />
      ) : (
        <div className="chatList">
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
