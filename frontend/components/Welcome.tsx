import { Code2, FileText, Image as ImageIcon, ReceiptText, Sparkles } from "lucide-react";

type Props = {
  onPromptSelect: (text: string) => void;
};

export default function Welcome({ onPromptSelect }: Props) {
  return (
    <section className="welcome">
      <div className="bigSpark">
        <Sparkles size={54} />
      </div>

      <h1>
        안녕하세요
        <br />
        BLOS AI가 도와드릴게요
      </h1>

      <div className="quickGrid">
        <button onClick={() => onPromptSelect("문제 사진을 올릴게. 이거 풀어줘")}>
          <FileText size={22} />
          <span>문제 사진 풀이</span>
        </button>
        <button onClick={() => onPromptSelect("이 사진을 자세히 분석해줘")}>
          <ImageIcon size={22} />
          <span>사진 분석</span>
        </button>
        <button onClick={() => onPromptSelect("영수증 사진을 항목별로 정리해줘")}>
          <ReceiptText size={22} />
          <span>영수증 정리</span>
        </button>
        <button onClick={() => onPromptSelect("이 코드 오류 원인을 찾아줘")}>
          <Code2 size={22} />
          <span>코드 오류 해결</span>
        </button>
      </div>

      <div className="suggestions">
        <p>추천 사용법</p>
        <span onClick={() => onPromptSelect("문제 사진 올리고 풀이해달라고 하기")}>
          문제 사진 올리고 풀이 받기
        </span>
        <span onClick={() => onPromptSelect("영수증 사진을 정리해줘")}>영수증 사진 정리</span>
        <span onClick={() => onPromptSelect("오류 화면을 올릴게. 뭐가 문제인지 알려줘")}>
          오류 화면 분석
        </span>
      </div>
    </section>
  );
}
