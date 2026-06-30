import re

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from services.model_router import choose_chat_model
from services.nvidia_client import client

router = APIRouter()


def normalize_name(text: str) -> str:
    return re.sub(r"[^가-힣a-zA-Z0-9\s]", "", text).strip()[:24]


def looks_like_bare_name(text: str) -> bool:
    name = normalize_name(text)
    return 2 <= len(name) <= 12 and re.fullmatch(r"[가-힣a-zA-Z0-9\s]+", name) is not None


def assistant_asked_for_name(text: str) -> bool:
    compact = re.sub(r"\s", "", text)
    return "이름" in compact and any(
        keyword in compact for keyword in ("알려", "말씀", "알수없", "모릅니다")
    )


def is_name_question(text: str) -> bool:
    compact = re.sub(r"\s", "", text)
    return any(
        keyword in compact for keyword in ("내이름", "제이름", "이름이뭐", "이름뭐")
    )


def infer_name_from_history(history: list[dict[str, str]]) -> str:
    for index, item in enumerate(history):
        text = item.get("text", "")
        role = item.get("role")

        explicit = re.search(
            r"(?:내\s*이름은|제\s*이름은|나는|난|저는|전)\s*([가-힣a-zA-Z0-9\s]{2,24})(?:이야|야|입니다|이에요|예요|임|$)",
            text,
            re.I,
        )
        if role == "user" and explicit:
            return normalize_name(explicit.group(1))

        next_item = history[index + 1] if index + 1 < len(history) else None
        if (
            role == "assistant"
            and next_item
            and next_item.get("role") == "user"
            and assistant_asked_for_name(text)
            and looks_like_bare_name(next_item.get("text", ""))
        ):
            return normalize_name(next_item.get("text", ""))

    return ""


class ChatRequest(BaseModel):
    message: str
    image_base64: str | None = None
    image_type: str | None = None
    model: str | None = "auto"
    history: list[dict[str, str]] = Field(default_factory=list)
    memory: dict[str, str] = Field(default_factory=dict)


@router.post("/chat/stream")
def chat_stream(req: ChatRequest):
    def generate():
        has_image = req.image_base64 is not None
        selected_model = choose_chat_model(req.model, has_image, req.message)

        user_text = req.message or "이 이미지를 분석해줘"
        inferred_name = (req.memory.get("name") or "").strip() or infer_name_from_history(
            req.history
        )
        last_history = req.history[-1] if req.history else None

        if is_name_question(user_text) and inferred_name:
            yield f"{inferred_name}님입니다."
            return

        if (
            last_history
            and last_history.get("role") == "assistant"
            and assistant_asked_for_name(last_history.get("text", ""))
            and looks_like_bare_name(user_text)
        ):
            yield f"{normalize_name(user_text)}님이라고 기억할게요."
            return

        if has_image:
            user_text = f"""
사용자 요청:
{user_text}

이미지가 함께 첨부되어 있어.

먼저 이미지 유형을 판단해:
1. 숙제/시험 문제
2. 문서/영수증/메모
3. 코드 화면
4. 일반 사진
5. 기타

숙제/시험 문제면 아래 형식으로 답해:

문제 읽기
필요한 개념
풀이 과정
정답
비슷한 문제 팁

글자가 잘 안 보이면 추측하지 말고 다시 찍어달라고 해.
"""

        history_messages = []
        for item in req.history[-16:]:
            role = item.get("role")
            text = (item.get("text") or "").strip()

            if role not in {"user", "assistant"} or not text:
                continue

            history_messages.append(
                {
                    "role": role,
                    "content": text[:3000],
                }
            )

        if history_messages:
            history_text = "\n".join(
                f"{'사용자' if item['role'] == 'user' else 'BLOS AI'}: {item['content']}"
                for item in history_messages[-10:]
            )
            user_text = f"""
아래는 같은 대화의 최근 기록이야. 현재 질문에 답할 때 이 기록을 우선 활용해.

[최근 대화 기록]
{history_text}

[현재 질문]
{user_text}
"""

        user_name = inferred_name
        if user_name:
            user_text = f"""
[사용자 메모리]
사용자의 이름: {user_name}

{user_text}
"""

        user_content = [{"type": "text", "text": user_text}]

        if has_image:
            user_content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{req.image_type or 'image/jpeg'};base64,{req.image_base64}"
                    },
                }
            )

        stream = client.chat.completions.create(
            model=selected_model,
            messages=[
                {
                    "role": "system",
                    "content": """
너는 BLOS AI야.
한국어로 친절하고 정확하게 답해.
너는 같은 대화 안에서 이전 메시지를 반드시 기억하고 활용해야 해.
사용자가 이름, 선호, 방금 말한 내용, 이전 질문을 물으면 대화 기록에서 찾아 답해.
이미 알고 있는 내용을 다시 묻지 말고, 모르면 모른다고 짧게 말해.
차량, 제품, 인물, 지명 같은 사실 질문은 모르면 지어내지 말고 불확실하다고 밝혀.
맥락 질문에서 "그럼", "그건", "방금 말한" 같은 표현이 나오면 최근 대화의 주제를 이어받아 답해.

역할:
- 일반 질문 답변
- 글쓰기와 번역
- 코딩 문제 해결
- 보고서와 문서 요약
- 이미지 분석
- 숙제 풀이 보조

규칙:
- 사용자가 모델을 몰라도 요청 의도를 보고 가장 적절한 방식으로 답한다.
- 코딩 질문은 원인, 해결 방법, 수정 예시를 함께 준다.
- 이미지가 있으면 먼저 유형을 판단하고 유형에 맞게 답한다.
- 글자가 잘 안 보이면 억지로 추측하지 않는다.
- 일반 질문에는 너무 딱딱하게 굴지 말고, 필요한 만큼만 명확하게 답한다.
""",
                },
                *history_messages,
                {
                    "role": "user",
                    "content": user_content,
                },
            ],
            temperature=0.35,
            max_tokens=1800,
            stream=True,
        )

        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    return StreamingResponse(generate(), media_type="text/plain")
