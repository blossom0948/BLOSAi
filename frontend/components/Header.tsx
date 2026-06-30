"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Menu, Sparkles } from "lucide-react";
import { UserSettings } from "../types/chat";

type Props = {
  onMenuClick: () => void;
  onNewChat: () => void;
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
};

const MODEL_LABELS: Record<UserSettings["model"], string> = {
  auto: "Auto 추천",
  minimax: "MiniMax M3",
  deepseek: "DeepSeek V4",
  glm: "GLM 5.1",
  image: "Qwen Image",
};

const MODEL_OPTIONS: Array<{
  value: UserSettings["model"];
  label: string;
  caption: string;
}> = [
  { value: "auto", label: "Auto 추천", caption: "요청에 맞게 자동 선택" },
  { value: "minimax", label: "MiniMax M3", caption: "일반 대화와 글쓰기" },
  { value: "deepseek", label: "DeepSeek V4", caption: "코드 오류와 개발" },
  { value: "glm", label: "GLM 5.1", caption: "번역과 정리" },
  { value: "image", label: "Qwen Image", caption: "이미지 생성" },
];

export default function Header({
  onMenuClick,
  onNewChat,
  settings,
  onSettingsChange,
}: Props) {
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!modelWrapRef.current?.contains(event.target as Node)) {
        setModelMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <header className="header">
      <button className="iconButton" onClick={onMenuClick} aria-label="사이드바 열기">
        <Menu size={25} />
      </button>

      <button className="logoArea" onClick={onNewChat} aria-label="새 채팅 시작">
        <span className="logoSpark">
          <Sparkles size={22} />
        </span>
        <span className="logoText">BLOS AI</span>
      </button>

      <div className="headerModelWrap" ref={modelWrapRef}>
        <button
          type="button"
          className={`headerModelPicker ${modelMenuOpen ? "open" : ""}`}
          onClick={() => setModelMenuOpen((open) => !open)}
          aria-label="AI 모델 선택"
          aria-expanded={modelMenuOpen}
        >
          <span>{MODEL_LABELS[settings.model]}</span>
          <ChevronDown size={16} />
        </button>

        {modelMenuOpen && (
          <div className="modelMenu">
            {MODEL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={settings.model === option.value ? "active" : ""}
                onClick={() => {
                  onSettingsChange({ ...settings, model: option.value });
                  setModelMenuOpen(false);
                }}
              >
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.caption}</small>
                </span>
                {settings.model === option.value && <Check size={16} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
