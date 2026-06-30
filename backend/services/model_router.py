CHAT_MODELS = {
    "auto": "deepseek-ai/deepseek-v4-flash",
    "minimax": "minimaxai/minimax-m3",
    "deepseek": "deepseek-ai/deepseek-v4-flash",
    "glm": "z-ai/glm-5.1",
}

IMAGE_MODEL = "qwen/qwen-image"

CODING_KEYWORDS = (
    "코드",
    "에러",
    "오류",
    "버그",
    "함수",
    "컴포넌트",
    "typescript",
    "javascript",
    "python",
    "react",
    "next",
)

TRANSLATION_KEYWORDS = (
    "번역",
    "영어로",
    "한국어로",
    "일본어로",
    "중국어로",
    "translate",
)


def choose_chat_model(model: str | None, has_image: bool, message: str | None = None):
    if has_image:
        return "minimaxai/minimax-m3"

    if not model or model == "auto":
        lowered = (message or "").lower()

        if any(keyword in lowered for keyword in CODING_KEYWORDS):
            return CHAT_MODELS["deepseek"]

        if any(keyword in lowered for keyword in TRANSLATION_KEYWORDS):
            return CHAT_MODELS["glm"]

        return CHAT_MODELS["auto"]

    return CHAT_MODELS.get(model, CHAT_MODELS["auto"])
