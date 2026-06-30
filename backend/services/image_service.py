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
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text,
        )

    data = response.json()
    return data["data"][0]["b64_json"]
