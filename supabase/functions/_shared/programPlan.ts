export type ProgramMainTopic = {
  title: string;
  source: string;
  category: string;
  intro: string;
  background: string;
  impact: string;
  supplement: string;
};

export type ProgramQuickNews = {
  title: string;
  source: string;
  category: string;
  summary: string;
  durationSecTarget: number;
};

export type ProgramSmallTalk = {
  title: string;
  mood: string;
  talkingPoint: string;
};

export type ProgramPlan = {
  role: "editor-in-chief";
  main_topics: ProgramMainTopic[];
  quick_news: ProgramQuickNews[];
  small_talk: ProgramSmallTalk[];
  letters: {
    host_prompt: string;
  };
  ending: {
    message: string;
  };
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const readEnvInt = (name: string): number | null => {
  const raw = Deno.env.get(name);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const resolveProgramCounts = (): {
  main: number;
  quick: number;
  smallTalk: number;
} => {
  const defaultMain = 3;
  const defaultQuick = 6;
  const defaultTotal = 10;

  const main = clamp(readEnvInt("TREND_TARGET_DEEPDIVE") ?? defaultMain, 2, 6);
  const quick = clamp(readEnvInt("TREND_TARGET_QUICKNEWS") ?? defaultQuick, 3, 10);
  const total = clamp(readEnvInt("TREND_TARGET_TOTAL") ?? defaultTotal, 8, 14);
  const smallTalk = clamp(total - main - quick, 0, 3);

  return { main, quick, smallTalk };
};

const PROGRAM_COUNTS = resolveProgramCounts();

export const PROGRAM_MAIN_TOPICS_COUNT = PROGRAM_COUNTS.main;
export const PROGRAM_QUICK_NEWS_COUNT = PROGRAM_COUNTS.quick;
export const PROGRAM_SMALL_TALK_COUNT = PROGRAM_COUNTS.smallTalk;
