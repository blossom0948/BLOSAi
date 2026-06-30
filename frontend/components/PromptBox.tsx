"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  ImagePlus,
  Mic,
  Paperclip,
  Plus,
  Send,
  Square,
  X,
} from "lucide-react";

type Props = {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  loading: boolean;
  selectedImage: File | null;
  setSelectedImage: (file: File | null) => void;
};

export default function PromptBox({
  input,
  setInput,
  onSend,
  onStop,
  loading,
  selectedImage,
  setSelectedImage,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const promptOuterRef = useRef<HTMLDivElement | null>(null);

  const objectUrl = useMemo(() => {
    if (!selectedImage) return "";
    return URL.createObjectURL(selectedImage);
  }, [selectedImage]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!promptOuterRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function chooseFile(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("지금은 이미지 파일만 지원합니다.");
      return;
    }

    setSelectedImage(file);
    setMenuOpen(false);
  }

  return (
    <div className="promptOuter" ref={promptOuterRef}>
      {menuOpen && (
        <div className="attachMenu">
          <button type="button" onClick={() => photoInputRef.current?.click()}>
            <span className="attachSymbol">
              <ImagePlus size={26} />
            </span>
            <strong>사진</strong>
            <small>갤러리에서 선택</small>
          </button>

          <button type="button" onClick={() => cameraInputRef.current?.click()}>
            <span className="attachSymbol">
              <Camera size={26} />
            </span>
            <strong>카메라</strong>
            <small>바로 촬영</small>
          </button>

          <button type="button" onClick={() => fileInputRef.current?.click()}>
            <span className="attachSymbol">
              <Paperclip size={26} />
            </span>
            <strong>파일</strong>
            <small>이미지 파일 선택</small>
          </button>
        </div>
      )}

      {selectedImage && (
        <div className="imagePreview">
          {objectUrl && <img src={objectUrl} alt="첨부 이미지 미리보기" />}
          <span>{selectedImage.name}</span>
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            aria-label="첨부 제거"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="promptBox">
        <button
          type="button"
          className="promptIcon"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="첨부 메뉴"
        >
          <Plus size={24} />
        </button>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="무엇이든 물어보세요"
          rows={1}
        />

        <button type="button" className="micButton" aria-label="음성 입력">
          <Mic size={22} />
        </button>

        {loading ? (
          <button
            type="button"
            className="sendButton stop"
            onClick={onStop}
            aria-label="응답 중지"
          >
            <Square size={18} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            className="sendButton"
            onClick={onSend}
            aria-label="전송"
          >
            <Send size={19} />
          </button>
        )}

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => chooseFile(e.target.files?.[0])}
        />

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => chooseFile(e.target.files?.[0])}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => chooseFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
