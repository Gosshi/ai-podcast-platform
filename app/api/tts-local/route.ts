import { handleTtsRequest } from "@/src/lib/tts/apiRoute";
import { checkRateLimit } from "@/app/lib/apiResponse";
import { expensiveLimiter, extractRateLimitKey } from "@/app/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const rateLimitResponse = checkRateLimit(expensiveLimiter, extractRateLimitKey(request));
  if (rateLimitResponse) return rateLimitResponse;

  return handleTtsRequest(request);
}
