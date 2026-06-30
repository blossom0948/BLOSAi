from fastapi import APIRouter
from pydantic import BaseModel

from services.image_service import generate_image_base64

router = APIRouter()


class ImageRequest(BaseModel):
    prompt: str


@router.post("/image/generate")
def generate_image(req: ImageRequest):
    return {"image_base64": generate_image_base64(req.prompt)}
