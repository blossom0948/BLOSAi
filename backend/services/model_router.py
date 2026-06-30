CHAT_MODELS = {
    "auto": "minimaxai/minimax-m3",
    "minimax": "minimaxai/minimax-m3",
    "deepseek": "deepseek-ai/deepseek-v4-flash",
    "glm": "z-ai/glm-5.1",
}

IMAGE_MODEL = "qwen-image"


def choose_chat_model(model: str | None, has_image: bool):
    if has_image:
        return "minimaxai/minimax-m3"

    if not model:
        return CHAT_MODELS["auto"]

    return CHAT_MODELS.get(model, CHAT_MODELS["auto"])