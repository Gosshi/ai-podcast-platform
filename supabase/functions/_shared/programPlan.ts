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

export const PROGRAM_MAIN_TOPICS_COUNT = 3;
export const PROGRAM_QUICK_NEWS_COUNT = 4;
export const PROGRAM_SMALL_TALK_COUNT = 2;
