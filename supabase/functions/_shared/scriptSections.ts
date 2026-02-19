export type ScriptSection = {
  heading: string;
  body: string;
};

export type SectionsCharsBreakdown = Record<string, number>;

const SECTION_MARKER_PATTERN = /^\[([^\]]+)\]\s*$/;

export const renderScriptSections = (sections: ScriptSection[]): string => {
  return sections
    .map((section) => `[${section.heading}]\n${section.body.trim()}`)
    .join("\n\n")
    .trim();
};

export const parseScriptSections = (script: string): ScriptSection[] => {
  const sections: ScriptSection[] = [];
  let activeHeading: string | null = null;
  let activeLines: string[] = [];

  const flush = () => {
    if (!activeHeading) return;
    sections.push({
      heading: activeHeading,
      body: activeLines.join("\n").trim()
    });
    activeHeading = null;
    activeLines = [];
  };

  for (const line of script.split(/\r?\n/)) {
    const marker = line.match(SECTION_MARKER_PATTERN);
    if (marker) {
      flush();
      activeHeading = marker[1].trim();
      continue;
    }

    if (activeHeading) {
      activeLines.push(line);
    }
  }

  flush();
  return sections;
};

export const buildSectionsCharsBreakdown = (script: string): SectionsCharsBreakdown => {
  const sections = parseScriptSections(script);
  const breakdown: SectionsCharsBreakdown = {};

  for (const section of sections) {
    breakdown[section.heading] = section.body.length;
  }

  return breakdown;
};
