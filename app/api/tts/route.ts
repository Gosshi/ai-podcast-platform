import { handleTtsRequest } from "@/src/lib/tts/apiRoute";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleTtsRequest(request);
}
