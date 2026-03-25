import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/app/lib/adminGuard";
import { verifyCsrfOrigin } from "@/app/lib/csrf";
import { checkRateLimit, toNonEmptyString } from "@/app/lib/apiResponse";
import { adminLimiter, extractRateLimitKey } from "@/app/lib/rateLimit";
import { publishManualJaEpisode } from "@/src/lib/manualJaEpisodePublish";

export const runtime = "nodejs";

type ManualPublishResponse = {
  ok: boolean;
  episodeId: string | null;
  status: string | null;
  publishedAt: string | null;
  audioUrl: string | null;
  durationSec: number | null;
  judgmentCardsCount: number;
  provider: string | null;
  permalink: string | null;
  error: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const buildResponse = (value: ManualPublishResponse, status = 200) => {
  return NextResponse.json(value, { status });
};

const resolveTtsBaseUrl = (request: NextRequest): string => {
  return new URL("/", request.url).origin.replace(/\/+$/, "");
};

export async function POST(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(adminLimiter, extractRateLimitKey(request));
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const csrf = verifyCsrfOrigin(request);
  if (!csrf.ok) {
    return buildResponse(
      {
        ok: false,
        episodeId: null,
        status: null,
        publishedAt: null,
        audioUrl: null,
        durationSec: null,
        judgmentCardsCount: 0,
        provider: null,
        permalink: null,
        error: csrf.error
      },
      403
    );
  }

  const admin = await verifyAdmin();
  if (!admin) {
    return buildResponse(
      {
        ok: false,
        episodeId: null,
        status: null,
        publishedAt: null,
        audioUrl: null,
        durationSec: null,
        judgmentCardsCount: 0,
        provider: null,
        permalink: null,
        error: "admin_auth_required"
      },
      403
    );
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (!isRecord(body)) {
    return buildResponse(
      {
        ok: false,
        episodeId: null,
        status: null,
        publishedAt: null,
        audioUrl: null,
        durationSec: null,
        judgmentCardsCount: 0,
        provider: null,
        permalink: null,
        error: "invalid_json"
      },
      400
    );
  }

  try {
    const result = await publishManualJaEpisode({
      title: toNonEmptyString(body.title) ?? "",
      description: toNonEmptyString(body.description) ?? "",
      script: toNonEmptyString(body.script) ?? "",
      episodeDate: toNonEmptyString(body.episodeDate) ?? "",
      genre: toNonEmptyString(body.genre) ?? "tech",
      previewText: toNonEmptyString(body.previewText),
      existingEpisodeId: toNonEmptyString(body.existingEpisodeId),
      publish: typeof body.publish === "boolean" ? body.publish : true,
      ttsFormat: body.ttsFormat === "aac" || body.ttsFormat === "opus" || body.ttsFormat === "flac" || body.ttsFormat === "wav" || body.ttsFormat === "pcm"
        ? body.ttsFormat
        : "mp3",
      ttsBaseUrl: resolveTtsBaseUrl(request)
    });

    return buildResponse({
      ok: true,
      episodeId: result.episodeId,
      status: result.status,
      publishedAt: result.publishedAt,
      audioUrl: result.audioUrl,
      durationSec: result.durationSec,
      judgmentCardsCount: result.judgmentCardsCount,
      provider: result.provider,
      permalink: result.permalink,
      error: null
    });
  } catch (error) {
    return buildResponse(
      {
        ok: false,
        episodeId: null,
        status: null,
        publishedAt: null,
        audioUrl: null,
        durationSec: null,
        judgmentCardsCount: 0,
        provider: null,
        permalink: null,
        error: error instanceof Error ? error.message : "manual_publish_failed"
      },
      500
    );
  }
}
