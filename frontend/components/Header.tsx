import { Menu, Sparkles } from "lucide-react";

type Props = {
  onMenuClick: () => void;
};

export default function Header({ onMenuClick }: Props) {
  return (
    <header className="header">
      <button className="iconButton" onClick={onMenuClick} aria-label="사이드바 열기">
        <Menu size={25} />
      </button>

      <div className="logoArea">
        <span className="logoSpark">
          <Sparkles size={22} />
        </span>
        <span className="logoText">BLOS AI</span>
      </div>

      <div className="modelBadge">NVIDIA MiniMax</div>
    </header>
  );
}
