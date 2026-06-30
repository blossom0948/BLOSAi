"use client";

import { useState } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import PromptBox from "../components/PromptBox";
import { useChat } from "../hooks/useChat";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const {
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
  } = useChat();

  function exportCurrentChat() {
    if (messages.length === 0) return;

    const content = messages
      .map((msg) => `${msg.role === "user" ? "나" : "BLOS AI"}:\n${msg.text}`)
      .join("\n\n--------------------\n\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "blos-ai-chat.txt";
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <main
      className={`appShell ${settings.compactMode ? "compact" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);

        const file = e.dataTransfer.files?.[0];

        if (file && file.type.startsWith("image/")) {
          setSelectedImage(file);
        }
      }}
    >
      {dragging && <div className="dropOverlay">이미지를 여기에 놓으세요</div>}

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={newChat}
        conversations={conversations}
        currentId={currentId}
        onOpenConversation={openConversation}
        onDeleteConversation={deleteConversation}
        onClearConversations={clearConversations}
        loggedIn={loggedIn}
        onLogin={login}
        onLogout={logout}
        settings={settings}
        onSettingsChange={updateSettings}
      />

      <Header onMenuClick={() => setSidebarOpen(true)} />

      {messages.length > 0 && (
        <button className="exportButton" onClick={exportCurrentChat}>
          대화 저장
        </button>
      )}

      <ChatWindow
        messages={messages}
        loading={loading}
        onPromptSelect={setInput}
      />

      <PromptBox
        input={input}
        setInput={setInput}
        onSend={sendMessage}
        onStop={stopGeneration}
        loading={loading}
        selectedImage={selectedImage}
        setSelectedImage={setSelectedImage}
      />
    </main>
  );
}
