export type TrendSourceSeed = {
  source_key: string;
  name: string;
  url: string;
  enabled: boolean;
  weight: number;
  category: string;
  theme: string;
};

export const TREND_SOURCE_THEMES: Record<string, TrendSourceSeed[]> = {
  top: [
    {
      source_key: "google_news_top_jp",
      name: "Google News Top (JP)",
      url: "https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja",
      enabled: true,
      weight: 1.15,
      category: "news",
      theme: "top"
    },
    {
      source_key: "google_news_top_us",
      name: "Google News Top (US)",
      url: "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.1,
      category: "news",
      theme: "top"
    },
    {
      source_key: "nhk_news",
      name: "NHK News",
      url: "https://www3.nhk.or.jp/rss/news/cat0.xml",
      enabled: true,
      weight: 1.05,
      category: "news",
      theme: "top"
    }
  ],
  technology: [
    {
      source_key: "google_news_technology",
      name: "Google News Technology",
      url: "https://news.google.com/rss/search?q=technology&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.3,
      category: "tech",
      theme: "technology"
    },
    {
      source_key: "google_news_technology_jp",
      name: "Google News Technology (JP)",
      url: "https://news.google.com/rss/search?q=%E3%83%86%E3%82%AF%E3%83%8E%E3%83%AD%E3%82%B8%E3%83%BC&hl=ja&gl=JP&ceid=JP:ja",
      enabled: true,
      weight: 1.3,
      category: "tech",
      theme: "technology"
    },
    {
      source_key: "techcrunch",
      name: "TechCrunch",
      url: "https://techcrunch.com/feed/",
      enabled: true,
      weight: 1.22,
      category: "tech",
      theme: "technology"
    },
    {
      source_key: "the_verge",
      name: "The Verge",
      url: "https://www.theverge.com/rss/index.xml",
      enabled: true,
      weight: 1.18,
      category: "tech",
      theme: "technology"
    },
    {
      source_key: "gigazine",
      name: "GIGAZINE",
      url: "https://gigazine.net/news/rss_2.0/",
      enabled: true,
      weight: 1.2,
      category: "tech",
      theme: "technology"
    }
  ],
  ai: [
    {
      source_key: "google_news_ai",
      name: "Google News AI",
      url: "https://news.google.com/rss/search?q=artificial+intelligence&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.35,
      category: "ai",
      theme: "ai"
    },
    {
      source_key: "google_news_ai_jp",
      name: "Google News AI (JP)",
      url: "https://news.google.com/rss/search?q=%E7%94%9F%E6%88%90AI&hl=ja&gl=JP&ceid=JP:ja",
      enabled: true,
      weight: 1.35,
      category: "ai",
      theme: "ai"
    },
    {
      source_key: "google_news_machine_learning",
      name: "Google News Machine Learning",
      url: "https://news.google.com/rss/search?q=machine+learning&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.28,
      category: "ai",
      theme: "ai"
    }
  ],
  startup: [
    {
      source_key: "google_news_startup",
      name: "Google News Startup",
      url: "https://news.google.com/rss/search?q=startup&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.14,
      category: "startup",
      theme: "startup"
    },
    {
      source_key: "google_news_startup_jp",
      name: "Google News Startup (JP)",
      url: "https://news.google.com/rss/search?q=%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%88%E3%82%A2%E3%83%83%E3%83%97&hl=ja&gl=JP&ceid=JP:ja",
      enabled: true,
      weight: 1.14,
      category: "startup",
      theme: "startup"
    },
    {
      source_key: "hacker_news_frontpage",
      name: "Hacker News Frontpage",
      url: "https://hnrss.org/frontpage",
      enabled: true,
      weight: 1.16,
      category: "startup",
      theme: "startup"
    }
  ],
  entertainment: [
    {
      source_key: "google_news_entertainment",
      name: "Google News Entertainment",
      url: "https://news.google.com/rss/search?q=entertainment&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.08,
      category: "entertainment",
      theme: "entertainment"
    },
    {
      source_key: "google_news_entertainment_jp",
      name: "Google News Entertainment (JP)",
      url: "https://news.google.com/rss/search?q=%E3%82%A8%E3%83%B3%E3%82%BF%E3%83%A1&hl=ja&gl=JP&ceid=JP:ja",
      enabled: true,
      weight: 1.08,
      category: "entertainment",
      theme: "entertainment"
    },
    {
      source_key: "google_news_sports_jp",
      name: "Google News Sports (JP)",
      url: "https://news.google.com/rss/search?q=%E3%82%B9%E3%83%9D%E3%83%BC%E3%83%84&hl=ja&gl=JP&ceid=JP:ja",
      enabled: true,
      weight: 1.05,
      category: "entertainment",
      theme: "entertainment"
    },
    {
      source_key: "google_news_culture",
      name: "Google News Culture",
      url: "https://news.google.com/rss/search?q=culture&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.04,
      category: "entertainment",
      theme: "entertainment"
    },
    {
      source_key: "google_news_streaming_global",
      name: "Google News Streaming",
      url: "https://news.google.com/rss/search?q=streaming+platform&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.2,
      category: "streaming",
      theme: "entertainment"
    },
    {
      source_key: "google_news_streaming_jp",
      name: "Google News Streaming (JP)",
      url: "https://news.google.com/rss/search?q=%E9%85%8D%E4%BF%A1+%E3%82%B5%E3%83%BC%E3%83%93%E3%82%B9&hl=ja&gl=JP&ceid=JP:ja",
      enabled: true,
      weight: 1.2,
      category: "streaming",
      theme: "entertainment"
    },
    {
      source_key: "google_news_celebrity_global",
      name: "Google News Celebrity",
      url: "https://news.google.com/rss/search?q=celebrity+entertainment&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.14,
      category: "celebrity",
      theme: "entertainment"
    },
    {
      source_key: "google_news_celebrity_jp",
      name: "Google News Celebrity (JP)",
      url: "https://news.google.com/rss/search?q=%E8%8A%B8%E8%83%BD%E4%BA%BA&hl=ja&gl=JP&ceid=JP:ja",
      enabled: true,
      weight: 1.14,
      category: "celebrity",
      theme: "entertainment"
    },
    {
      source_key: "google_news_anime_global",
      name: "Google News Anime",
      url: "https://news.google.com/rss/search?q=anime&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.18,
      category: "anime",
      theme: "entertainment"
    },
    {
      source_key: "google_news_anime_jp",
      name: "Google News Anime (JP)",
      url: "https://news.google.com/rss/search?q=%E3%82%A2%E3%83%8B%E3%83%A1&hl=ja&gl=JP&ceid=JP:ja",
      enabled: true,
      weight: 1.2,
      category: "anime",
      theme: "entertainment"
    },
    {
      source_key: "google_news_manga_jp",
      name: "Google News Manga (JP)",
      url: "https://news.google.com/rss/search?q=%E6%BC%AB%E7%94%BB&hl=ja&gl=JP&ceid=JP:ja",
      enabled: true,
      weight: 1.16,
      category: "anime",
      theme: "entertainment"
    },
    {
      source_key: "google_news_game_global",
      name: "Google News Video Games",
      url: "https://news.google.com/rss/search?q=video+games&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.2,
      category: "game",
      theme: "entertainment"
    },
    {
      source_key: "google_news_game_jp",
      name: "Google News Games (JP)",
      url: "https://news.google.com/rss/search?q=%E3%82%B2%E3%83%BC%E3%83%A0&hl=ja&gl=JP&ceid=JP:ja",
      enabled: true,
      weight: 1.22,
      category: "game",
      theme: "entertainment"
    },
    {
      source_key: "google_news_esports",
      name: "Google News Esports",
      url: "https://news.google.com/rss/search?q=esports&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.12,
      category: "game",
      theme: "entertainment"
    },
    {
      source_key: "google_news_nintendo",
      name: "Google News Nintendo",
      url: "https://news.google.com/rss/search?q=nintendo&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.14,
      category: "game",
      theme: "entertainment"
    },
    {
      source_key: "google_news_playstation",
      name: "Google News PlayStation",
      url: "https://news.google.com/rss/search?q=playstation&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.14,
      category: "game",
      theme: "entertainment"
    },
    {
      source_key: "google_news_xbox",
      name: "Google News Xbox",
      url: "https://news.google.com/rss/search?q=xbox&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.12,
      category: "game",
      theme: "entertainment"
    },
    {
      source_key: "google_news_youtube_creators",
      name: "Google News YouTube Creators",
      url: "https://news.google.com/rss/search?q=youtube+creator&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.2,
      category: "video",
      theme: "entertainment"
    },
    {
      source_key: "google_news_youtube_jp",
      name: "Google News YouTube (JP)",
      url: "https://news.google.com/rss/search?q=YouTube&hl=ja&gl=JP&ceid=JP:ja",
      enabled: true,
      weight: 1.22,
      category: "video",
      theme: "entertainment"
    },
    {
      source_key: "google_news_vtuber_jp",
      name: "Google News VTuber (JP)",
      url: "https://news.google.com/rss/search?q=VTuber&hl=ja&gl=JP&ceid=JP:ja",
      enabled: true,
      weight: 1.24,
      category: "video",
      theme: "entertainment"
    },
    {
      source_key: "oricon_news",
      name: "ORICON NEWS",
      url: "https://www.oricon.co.jp/rss/news.xml",
      enabled: true,
      weight: 1.28,
      category: "entertainment",
      theme: "entertainment"
    },
    {
      source_key: "modelpress",
      name: "モデルプレス",
      url: "https://mdpr.jp/rss/index.xml",
      enabled: true,
      weight: 1.26,
      category: "entertainment",
      theme: "entertainment"
    },
    {
      source_key: "animeanime",
      name: "アニメ！アニメ！",
      url: "https://animeanime.jp/rss/index.xml",
      enabled: true,
      weight: 1.32,
      category: "anime",
      theme: "entertainment"
    },
    {
      source_key: "gamer_4gamer",
      name: "4Gamer",
      url: "https://www.4gamer.net/rss/index.xml",
      enabled: true,
      weight: 1.34,
      category: "game",
      theme: "entertainment"
    },
    {
      source_key: "eigacom",
      name: "映画.com",
      url: "https://eiga.com/rss/all.xml",
      enabled: true,
      weight: 1.24,
      category: "entertainment",
      theme: "entertainment"
    },
    {
      source_key: "natalie_all",
      name: "ナタリー総合",
      url: "https://natalie.mu/rss/all.xml",
      enabled: true,
      weight: 1.28,
      category: "entertainment",
      theme: "entertainment"
    },
    {
      source_key: "natalie_music",
      name: "ナタリー音楽",
      url: "https://natalie.mu/music/rss",
      enabled: true,
      weight: 1.26,
      category: "entertainment",
      theme: "entertainment"
    },
    {
      source_key: "natalie_comic",
      name: "ナタリーコミック",
      url: "https://natalie.mu/comic/rss",
      enabled: true,
      weight: 1.3,
      category: "anime",
      theme: "entertainment"
    },
    {
      source_key: "famitsu",
      name: "ファミ通",
      url: "https://www.famitsu.com/rss/famitsu.rss",
      enabled: true,
      weight: 1.3,
      category: "game",
      theme: "entertainment"
    },
    {
      source_key: "game_watch",
      name: "GAME Watch",
      url: "https://game.watch.impress.co.jp/data/rss/1.0/gmw/feed.rdf",
      enabled: true,
      weight: 1.28,
      category: "game",
      theme: "entertainment"
    },
    {
      source_key: "inside_games",
      name: "INSIDE",
      url: "https://www.inside-games.jp/rss20/index.rdf",
      enabled: true,
      weight: 1.24,
      category: "game",
      theme: "entertainment"
    },
    {
      source_key: "youtube_trending_jp",
      name: "YouTube急上昇 (JP)",
      url: "https://news.google.com/rss/search?q=YouTube+%E6%80%A5%E4%B8%8A%E6%98%87&hl=ja&gl=JP&ceid=JP:ja",
      enabled: true,
      weight: 1.34,
      category: "video",
      theme: "entertainment"
    },
    {
      source_key: "youtube_trending_global",
      name: "YouTube Trending",
      url: "https://news.google.com/rss/search?q=youtube+trending&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.26,
      category: "video",
      theme: "entertainment"
    },
    {
      source_key: "google_news_movie_jp",
      name: "Google News Movies (JP)",
      url: "https://news.google.com/rss/search?q=%E6%98%A0%E7%94%BB&hl=ja&gl=JP&ceid=JP:ja",
      enabled: true,
      weight: 1.24,
      category: "movie",
      theme: "entertainment"
    },
    {
      source_key: "google_news_hollywood",
      name: "Google News Hollywood",
      url: "https://news.google.com/rss/search?q=hollywood&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.2,
      category: "movie",
      theme: "entertainment"
    },
    {
      source_key: "google_news_music_global",
      name: "Google News Music",
      url: "https://news.google.com/rss/search?q=music+industry&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.22,
      category: "music",
      theme: "entertainment"
    },
    {
      source_key: "google_news_music_jp",
      name: "Google News Music (JP)",
      url: "https://news.google.com/rss/search?q=%E9%9F%B3%E6%A5%BD&hl=ja&gl=JP&ceid=JP:ja",
      enabled: true,
      weight: 1.24,
      category: "music",
      theme: "entertainment"
    },
    {
      source_key: "google_news_kpop",
      name: "Google News K-POP",
      url: "https://news.google.com/rss/search?q=K-POP&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.18,
      category: "music",
      theme: "entertainment"
    },
    {
      source_key: "google_news_disney",
      name: "Google News Disney",
      url: "https://news.google.com/rss/search?q=disney&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.16,
      category: "movie",
      theme: "entertainment"
    },
    {
      source_key: "google_news_netflix",
      name: "Google News Netflix",
      url: "https://news.google.com/rss/search?q=netflix&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.18,
      category: "movie",
      theme: "entertainment"
    },
    {
      source_key: "animenewsnetwork",
      name: "Anime News Network",
      url: "https://www.animenewsnetwork.com/all/rss.xml",
      enabled: true,
      weight: 1.34,
      category: "anime",
      theme: "entertainment"
    },
    {
      source_key: "variety",
      name: "Variety",
      url: "https://variety.com/feed/",
      enabled: true,
      weight: 1.22,
      category: "entertainment",
      theme: "entertainment"
    },
    {
      source_key: "hollywood_reporter",
      name: "The Hollywood Reporter",
      url: "https://www.hollywoodreporter.com/feed/",
      enabled: true,
      weight: 1.2,
      category: "movie",
      theme: "entertainment"
    },
    {
      source_key: "ign_all",
      name: "IGN",
      url: "https://feeds.ign.com/ign/all",
      enabled: true,
      weight: 1.3,
      category: "game",
      theme: "entertainment"
    },
    {
      source_key: "gamespot_all",
      name: "GameSpot",
      url: "https://www.gamespot.com/feeds/mashup/",
      enabled: true,
      weight: 1.28,
      category: "game",
      theme: "entertainment"
    }
  ],
  games: [
    {
      source_key: "pc_gamer",
      name: "PC Gamer",
      url: "https://www.pcgamer.com/rss/",
      enabled: true,
      weight: 1.3,
      category: "game",
      theme: "games"
    },
    {
      source_key: "eurogamer",
      name: "Eurogamer",
      url: "https://www.eurogamer.net/feed",
      enabled: true,
      weight: 1.28,
      category: "game",
      theme: "games"
    },
    {
      source_key: "polygon",
      name: "Polygon",
      url: "https://www.polygon.com/rss/index.xml",
      enabled: true,
      weight: 1.24,
      category: "game",
      theme: "games"
    }
  ],
  gadgets: [
    {
      source_key: "engadget",
      name: "Engadget",
      url: "https://www.engadget.com/rss.xml",
      enabled: true,
      weight: 1.3,
      category: "gadgets",
      theme: "gadgets"
    },
    {
      source_key: "wired",
      name: "WIRED",
      url: "https://www.wired.com/feed/rss",
      enabled: true,
      weight: 1.22,
      category: "gadgets",
      theme: "gadgets"
    },
    {
      source_key: "cnet_news",
      name: "CNET News",
      url: "https://www.cnet.com/rss/news/",
      enabled: true,
      weight: 1.16,
      category: "gadgets",
      theme: "gadgets"
    }
  ],
  lifestyle: [
    {
      source_key: "lifehacker",
      name: "Lifehacker",
      url: "https://lifehacker.com/rss",
      enabled: true,
      weight: 1.2,
      category: "lifestyle",
      theme: "lifestyle"
    },
    {
      source_key: "eater",
      name: "Eater",
      url: "https://www.eater.com/rss/index.xml",
      enabled: true,
      weight: 1.14,
      category: "lifestyle",
      theme: "lifestyle"
    },
    {
      source_key: "google_news_travel",
      name: "Google News Travel",
      url: "https://news.google.com/rss/search?q=travel+tips&hl=en-US&gl=US&ceid=US:en",
      enabled: true,
      weight: 1.12,
      category: "lifestyle",
      theme: "lifestyle"
    }
  ],
  culture: [
    {
      source_key: "nyt_arts",
      name: "NYTimes Arts",
      url: "https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml",
      enabled: true,
      weight: 1.2,
      category: "culture",
      theme: "culture"
    },
    {
      source_key: "guardian_culture",
      name: "The Guardian Culture",
      url: "https://www.theguardian.com/uk/culture/rss",
      enabled: true,
      weight: 1.18,
      category: "culture",
      theme: "culture"
    },
    {
      source_key: "book_riot",
      name: "Book Riot",
      url: "https://bookriot.com/feed/",
      enabled: true,
      weight: 1.16,
      category: "culture",
      theme: "culture"
    }
  ]
};

export const DEFAULT_TREND_RSS_SOURCES = Object.values(TREND_SOURCE_THEMES).flat();

export const DEFAULT_CLICKBAIT_KEYWORDS = [
  "衝撃",
  "ヤバい",
  "絶対",
  "今すぐ",
  "必見",
  "知らないと損",
  "worst",
  "shocking",
  "you won't believe",
  "must read",
  "must-see",
  "break the internet",
  "click here",
  "insane",
  "unbelievable",
  "mind blowing",
  "暴露",
  "炎上",
  "大炎上",
  "激怒",
  "神回"
];

export const parseCsvList = (rawValue: string | undefined, fallback: string[]): string[] => {
  if (!rawValue) return fallback;
  const values = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return values.length > 0 ? values : fallback;
};
