const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function streamChat({
  message,
  imageBase64,
  imageType,
  model,
  signal,
  onChunk,
}: {
  message: string;
  imageBase64: string | null;
  imageType: string | null;
  model: string;
  signal?: AbortSignal;
  onChunk: (text: string) => void;
}) {
  const res = await fetch(`${API_URL}/chat/stream`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      image_base64: imageBase64,
      image_type: imageType,
      model,
    }),
  });

  if (!res.ok) throw new Error("Chat request failed");
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    fullText += decoder.decode(value, { stream: true });
    onChunk(fullText);
  }

  return fullText;
}

export async function generateImage(prompt: string) {
  const res = await fetch(`${API_URL}/image/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
    }),
  });

  if (!res.ok) {
    throw new Error("Image generation failed");
  }

  const data = await res.json();

  return `data:image/png;base64,${data.image_base64}`;
}
