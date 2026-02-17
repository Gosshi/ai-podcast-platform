import { createAnonClient } from "@/app/lib/supabaseClients";

export const dynamic = "force-dynamic";

type EpisodeRow = {
  id: string;
  title: string | null;
  lang: "ja" | "en";
  published_at: string | null;
};

const formatDateTime = (value: string | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", { hour12: false });
};

const loadPublishedEpisodes = async (): Promise<{
  data: EpisodeRow[];
  error: string | null;
}> => {
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("episodes")
      .select("id, title, lang, published_at")
      .eq("status", "published")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false });

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: (data as EpisodeRow[]) ?? [], error: null };
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : "unknown_error" };
  }
};

export default async function EpisodesPage() {
  const { data, error } = await loadPublishedEpisodes();

  return (
    <main>
      <h1>Published Episodes</h1>
      <p>title / language / published_at</p>
      {error ? <p>Failed to load episodes: {error}</p> : null}
      {data.length === 0 ? (
        <p>No published episodes yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Language</th>
              <th>Published At</th>
            </tr>
          </thead>
          <tbody>
            {data.map((episode) => (
              <tr key={episode.id}>
                <td>{episode.title ?? "-"}</td>
                <td>{episode.lang}</td>
                <td>{formatDateTime(episode.published_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
