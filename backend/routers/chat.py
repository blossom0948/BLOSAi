from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from services.model_router import choose_chat_model
from services.nvidia_client import client

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    image_base64: str | None = None
    image_type: str | None = None
    model: str | None = "auto"
    history: list[dict[str, str]] = Field(default_factory=list)


@router.post("/chat/stream")
def chat_stream(req: ChatRequest):
    def generate():
        has_image = req.image_base64 is not None
        selected_model = choose_chat_model(req.model, has_image, req.message)

        user_text = req.message or "이 이미지를 분석해줘"

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
