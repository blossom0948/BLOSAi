"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";

type Props = {
  role: "user" | "ai";
  text: string;
  imageUrl?: string;
};

function renderText(text: string) {
  const parts = text.split(/```/g);

  return parts.map((part, index) => {
    const isCode = index % 2 === 1;

    if (isCode) {
      const lines = part.trim().split("\n");
      const language = lines[0]?.trim();
      const code = lines.slice(1).join("\n") || part.trim();

      return <CodeBlock key={index} code={code} language={language} />;
    }

    return (
      <div key={index} className="normalText">
        {part.split("\n").map((line, lineIndex) => {
          if (line.startsWith("# ")) return <h1 key={lineIndex}>{line.replace("# ", "")}</h1>;
          if (line.startsWith("## ")) return <h2 key={lineIndex}>{line.replace("## ", "")}</h2>;
          if (line.startsWith("### ")) return <h3 key={lineIndex}>{line.replace("### ", "")}</h3>;
          if (line.startsWith("- ")) return <li key={lineIndex}>{line.replace("- ", "")}</li>;
          if (line.trim() === "---") return <hr key={lineIndex} />;
          return <p key={lineIndex}>{line}</p>;
        })}
      </div>
    );
  });
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="codeBlock">
      <div className="codeHeader">
        <span>{language || "code"}</span>
        <button onClick={copyCode}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? "복사됨" : "복사"}</span>
        </button>
      </div>

      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function ChatMessage({ role, text, imageUrl }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyMessage() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className={`chatMessage ${role}`}>
      {role === "ai" && text && (
        <div className="messageTop">
          <button className="messageCopyButton" onClick={copyMessage}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? "복사됨" : "복사"}</span>
          </button>
        </div>
      )}

      {imageUrl && <img className="messageImage" src={imageUrl} alt="첨부 이미지" />}
      {role === "ai" && imageUrl && (
        <a className="imageDownloadButton" href={imageUrl} download="blos-ai-image.png">
          <Download size={14} />
          이미지 저장
        </a>
      )}

      <div className="messageText">{renderText(text)}</div>
    </div>
  );
}
