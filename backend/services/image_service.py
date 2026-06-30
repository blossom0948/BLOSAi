import os

import requests
from fastapi import HTTPException

from services.model_router import IMAGE_MODEL


def generate_image_base64(prompt: str) -> str:
    api_key = os.getenv("NVIDIA_API_KEY")

    if not api_key:
        raise HTTPException(status_code=500, detail="NVIDIA_API_KEY가 없습니다.")

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
