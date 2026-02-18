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
  "click here"
];

export const parseCsvList = (rawValue: string | undefined, fallback: string[]): string[] => {
  if (!rawValue) return fallback;
  const values = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return values.length > 0 ? values : fallback;
};
