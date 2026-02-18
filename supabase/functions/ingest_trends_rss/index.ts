import { jsonResponse } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

type RequestBody = {
  limitPerSource?: number;
  mockFeeds?: {
    sourceKey: string;
    name?: string;
    url?: string;
    weight?: number;
    category?: string;
    xml: string;
  }[];
};

type TrendSource = {
  id: string;
  source_key: string;
  name: string;
  url: string;
  enabled: boolean;
  weight: number;
  category: string;
};

type ParsedItem = {
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
};

const DEFAULT_LIMIT_PER_SOURCE = 20;

const DEFAULT_RSS_SOURCES = [
  {
    source_key: "nhk_news",
    name: "NHK News",
    url: "https://www3.nhk.or.jp/rss/news/cat0.xml",
    weight: 1,
    category: "news"
  },
  {
    source_key: "gigazine",
    name: "GIGAZINE",
    url: "https://gigazine.net/news/rss_2.0/",
    weight: 1.1,
    category: "tech"
  }
] as const;

const BASE_SIGNAL = 1;
const FRESHNESS_HALF_LIFE_HOURS = 24;
const MAX_FRESHNESS_WINDOW_HOURS = 48;

const normalizeTitleForHash = (value: string): string => {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, "");
};

const resolveFreshnessDecay = (publishedAt: string | null): number => {
  const baseline = publishedAt ? new Date(publishedAt) : new Date();
  if (Number.isNaN(baseline.getTime())) return 1;

  const diffMs = Math.max(0, Date.now() - baseline.getTime());
  const ageHours = Math.min(diffMs / (60 * 60 * 1000), MAX_FRESHNESS_WINDOW_HOURS);
  return Math.exp((-Math.log(2) * ageHours) / FRESHNESS_HALF_LIFE_HOURS);
};

const calculateScore = (sourceWeight: number, publishedAt: string | null): number => {
  const weight = Number.isFinite(sourceWeight) && sourceWeight > 0 ? sourceWeight : 1;
  const freshnessDecay = resolveFreshnessDecay(publishedAt);
  return weight * freshnessDecay * BASE_SIGNAL;
};

const normalizeDate = (value: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const decodeXmlText = (value: string): string => {
  return value
    .replaceAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
};

const readTag = (xmlBlock: string, tagNames: string[]): string | null => {
  for (const tagName of tagNames) {
    const match = xmlBlock.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"));
    if (match?.[1]) {
      return decodeXmlText(match[1].trim());
    }
  }

  return null;
};

const readLink = (xmlBlock: string): string | null => {
  const linkHrefMatch = xmlBlock.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
  if (linkHrefMatch?.[1]) {
    return decodeXmlText(linkHrefMatch[1].trim());
  }

  const linkBodyMatch = xmlBlock.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  if (linkBodyMatch?.[1]) {
    return decodeXmlText(linkBodyMatch[1].trim());
  }

  return null;
};

const parseRssItems = (xml: string): ParsedItem[] => {
  const blocks = Array.from(xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)).map(
    (match) => match[0]
  );

  return blocks
    .map((block) => {
      const title = readTag(block, ["title"]) ?? "";
      const url = readLink(block) ?? "";
      const summary = readTag(block, ["description", "summary", "content"]);
      const published = readTag(block, ["pubDate", "published", "updated"]);

      return {
        title,
        url,
        summary,
        publishedAt: normalizeDate(published)
      };
    })
    .filter((item) => item.title.length > 0 && item.url.length > 0);
};

const hashText = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const startTrendRun = async (payload: Record<string, unknown>): Promise<string> => {
  const { data, error } = await supabaseAdmin
    .from("trend_runs")
    .insert({
      status: "running",
      payload,
      fetched_count: 0,
      inserted_count: 0
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw error ?? new Error("failed to insert trend_runs row");
  }

  return String(data.id);
};

const finishTrendRun = async (
  runId: string,
  fetchedCount: number,
  insertedCount: number,
  payload: Record<string, unknown>
): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("trend_runs")
    .update({
      status: "success",
      fetched_count: fetchedCount,
      inserted_count: insertedCount,
      ended_at: new Date().toISOString(),
      payload
    })
    .eq("id", runId);

  if (error) {
    throw error;
  }
};

const failTrendRun = async (
  runId: string,
  errorMessage: string,
  fetchedCount: number,
  insertedCount: number,
  payload: Record<string, unknown>
): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("trend_runs")
    .update({
      status: "failed",
      fetched_count: fetchedCount,
      inserted_count: insertedCount,
      error: errorMessage,
      ended_at: new Date().toISOString(),
      payload
    })
    .eq("id", runId);

  if (error) {
    throw error;
  }
};

const upsertSources = async (body: RequestBody): Promise<TrendSource[]> => {
  const sourceSeeds =
    body.mockFeeds && body.mockFeeds.length > 0
      ? body.mockFeeds.map((feed) => ({
          source_key: feed.sourceKey,
          name: feed.name ?? feed.sourceKey,
          url: feed.url ?? `mock://${feed.sourceKey}`,
          enabled: true,
          weight: feed.weight ?? 1,
          category: feed.category ?? "general"
        }))
      : DEFAULT_RSS_SOURCES;

  const { error: upsertError } = await supabaseAdmin.from("trend_sources").upsert(sourceSeeds, {
    onConflict: "source_key"
  });
  if (upsertError) {
    throw upsertError;
  }

  const sourceKeys = sourceSeeds.map((source) => source.source_key);
  let query = supabaseAdmin
    .from("trend_sources")
    .select("id, source_key, name, url, enabled, weight, category")
    .in("source_key", sourceKeys)
    .order("source_key", { ascending: true });

  if (!body.mockFeeds || body.mockFeeds.length === 0) {
    query = query.eq("enabled", true);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data as TrendSource[]) ?? [];
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const limitPerSource = Math.max(1, Math.min(body.limitPerSource ?? DEFAULT_LIMIT_PER_SOURCE, 50));

  const runId = await startTrendRun({
    step: "ingest_trends_rss",
    limitPerSource,
    usingMockFeeds: Boolean(body.mockFeeds?.length)
  });

  let fetchedCount = 0;
  let insertedCount = 0;

  try {
    const sourceRows = await upsertSources(body);
    const sourceErrors: { sourceKey: string; message: string }[] = [];
    const mockFeedMap = new Map(body.mockFeeds?.map((feed) => [feed.sourceKey, feed.xml]) ?? []);

    for (const source of sourceRows) {
      try {
        const xml = mockFeedMap.get(source.source_key) ?? (await fetch(source.url).then((res) => res.text()));
        const parsedItems = parseRssItems(xml).slice(0, limitPerSource);

        fetchedCount += parsedItems.length;

        for (const item of parsedItems) {
          const hash = await hashText(`${source.source_key}:${item.url}`);
          const normalizedTitle = normalizeTitleForHash(item.title) || item.title.trim().toLowerCase();
          const normalizedHash = await hashText(`${source.source_key}:${normalizedTitle}`);
          const score = calculateScore(source.weight, item.publishedAt);

          const { error } = await supabaseAdmin.from("trend_items").insert({
            source_id: source.id,
            title: item.title,
            url: item.url,
            summary: item.summary,
            published_at: item.publishedAt,
            hash,
            normalized_hash: normalizedHash,
            score
          });

          if (error) {
            if (error.code === "23505") {
              continue;
            }

            throw error;
          }

          insertedCount += 1;
        }
      } catch (error) {
        sourceErrors.push({
          sourceKey: source.source_key,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    await finishTrendRun(runId, fetchedCount, insertedCount, {
      step: "ingest_trends_rss",
      limitPerSource,
      sourceCount: sourceRows.length,
      sourceErrors
    });

    return jsonResponse({
      ok: true,
      runId,
      fetchedCount,
      insertedCount,
      sourceCount: sourceRows.length,
      sourceErrors
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await failTrendRun(runId, message, fetchedCount, insertedCount, {
      step: "ingest_trends_rss",
      limitPerSource
    });

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
