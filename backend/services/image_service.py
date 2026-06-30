import os
from urllib.parse import quote

import requests
from fastapi import HTTPException

from services.model_router import IMAGE_MODEL


def generate_image_base64(prompt: str) -> str:
    try:
        return _generate_with_nvidia(prompt)
    except HTTPException as exc:
        if exc.status_code not in {404, 501, 502, 503}:
            raise

        fallback = os.getenv("IMAGE_FALLBACK_PROVIDER", "pollinations").lower()
        if fallback == "none":
            raise

        return _generate_with_pollinations(prompt)


def _generate_with_nvidia(prompt: str) -> str:
    api_key = os.getenv("NVIDIA_API_KEY")

    if not api_key:
        raise HTTPException(status_code=503, detail="NVIDIA_API_KEY가 없습니다.")

    response = requests.post(
        "https://integrate.api.nvidia.com/v1/images/generations",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": IMAGE_MODEL,
            "prompt": prompt,
            "size": "1024x1024",
            "response_format": "b64_json",
        },
        timeout=120,
    )

    if response.status_code >= 400:
        detail = response.text
        try:
            detail = response.json().get("detail") or response.json().get("message") or detail
        except ValueError:
            pass

        if response.status_code == 404 and "page not found" in detail.lower():
            detail = (
                "NVIDIA 이미지 생성 엔드포인트를 사용할 수 없습니다. "
                "API 키가 채팅 모델은 지원하지만 이미지 생성 Public API endpoint 권한이 없을 때 "
                "이 404가 발생할 수 있습니다. NVIDIA Build 계정에서 Qwen Image API 권한을 확인하세요."
            )

        raise HTTPException(
            status_code=response.status_code,
            detail=f"NVIDIA image generation failed: {detail}",
        )

    data = response.json()
    try:
        return data["data"][0]["b64_json"]
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Unexpected NVIDIA image response: {data}",
        ) from exc


def _generate_with_pollinations(prompt: str) -> str:
    encoded_prompt = quote(prompt.strip() or "BLOS AI generated image")
    urls = [
        f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=768&height=768&model=flux&nologo=true&private=true&seed=11",
        f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=768&height=768&model=turbo&nologo=true&private=true&seed=23",
        f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=512&height=512&nologo=true&private=true&seed=37",
    ]

    last_error = ""

    for image_url in urls:
        response = requests.get(image_url, timeout=120)

        if response.ok and response.content:
            import base64

            return base64.b64encode(response.content).decode("utf-8")

        last_error = response.text

    raise HTTPException(
        status_code=503,
        detail=f"Fallback image generation failed: {last_error}",
    )
