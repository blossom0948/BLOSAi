import { LogOut, Plus, Trash2, X } from "lucide-react";
import { Conversation, UserSettings } from "../types/chat";

type Props = {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  conversations: Conversation[];
  currentId: string;
  onOpenConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onClearConversations: () => void;
  loggedIn: boolean;
  onLogin: (username: string) => void;
  onLogout: () => void;
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
};

export default function Sidebar({
  open,
  onClose,
  onNewChat,
  conversations,
  currentId,
  onOpenConversation,
  onDeleteConversation,
  onClearConversations,
  loggedIn,
  onLogin,
  onLogout,
  settings,
  onSettingsChange,
}: Props) {
  function updateUsername() {
    const name = prompt("사용자 이름을 입력하세요.", settings.username);
    if (name !== null) onLogin(name);
  }

  return (
    <>
      <div className={`sidebarOverlay ${open ? "show" : ""}`} onClick={onClose} />

      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebarTop">
          <div>
            <h2>BLOS AI</h2>
            <p>{loggedIn ? `${settings.username} 로그인됨` : "임시 로그인이 필요해요"}</p>
          </div>
          <button onClick={onClose} aria-label="사이드바 닫기">
            <X size={22} />
          </button>
        </div>

        <div className="loginCard">
          {loggedIn ? (
            <>
              <div className="avatarCircle">{settings.username.slice(0, 1)}</div>
              <div>
                <strong>{settings.username}</strong>
                <button onClick={onLogout}>
                  <LogOut size={14} />
                  로그아웃
                </button>
              </div>
            </>
          ) : (
            <button onClick={updateUsername}>임시 로그인</button>
          )}
        </div>

        <button
          className="newChatButton"
          onClick={() => {
            onNewChat();
            onClose();
          }}
        >
          <Plus size={18} />
          새 대화
        </button>

        <div className="sidebarSection">
          <p>모델</p>

          <label className="settingItem">
            <span>AI 모델</span>
            <select
              value={settings.model}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  model: e.target.value as UserSettings["model"],
                })
              }
            >
              <option value="auto">Auto 추천</option>
              <option value="minimax">MiniMax M3</option>
              <option value="deepseek">DeepSeek V4 Flash</option>
              <option value="glm">GLM 5.1</option>
              <option value="image">Qwen Image 생성</option>
            </select>
          </label>
        </div>

        <div className="sidebarSection">
          <p>대화 기록</p>

          {conversations.length === 0 ? (
            <button>저장된 대화 없음</button>
          ) : (
            conversations.map((chat) => (
              <div className="conversationRow" key={chat.id}>
                <button
                  onClick={() => {
                    onOpenConversation(chat.id);
                    onClose();
                  }}
                  className={currentId === chat.id ? "activeConversation" : ""}
                >
                  {chat.title}
                </button>

                <button
                  className="deleteChatButton"
                  onClick={() => onDeleteConversation(chat.id)}
                  aria-label="대화 삭제"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="sidebarSection">
          <p>설정</p>

          <label className="settingToggle">
            <span>대화 저장</span>
            <input
              type="checkbox"
              checked={settings.saveHistory}
              onChange={(e) =>
                onSettingsChange({ ...settings, saveHistory: e.target.checked })
              }
            />
          </label>

          <label className="settingToggle">
            <span>컴팩트 모드</span>
            <input
              type="checkbox"
              checked={settings.compactMode}
              onChange={(e) =>
                onSettingsChange({ ...settings, compactMode: e.target.checked })
              }
            />
          </label>

          <button onClick={updateUsername}>사용자 이름 변경</button>
        </div>

        <div className="sidebarBottom">
          <button onClick={onClearConversations}>전체 대화 삭제</button>
        </div>
      </aside>
    </>
  );
}
