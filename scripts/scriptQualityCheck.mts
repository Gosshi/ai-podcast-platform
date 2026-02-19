import { readFileSync } from "node:fs";
import { stdin as input, stdout as output, stderr as error } from "node:process";
import { checkScriptQuality } from "../supabase/functions/_shared/scriptQualityCheck.ts";

const readFromStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];

  for await (const chunk of input) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
};

const parseArgs = (argv: string[]): { filePath: string | null; text: string | null } => {
  let filePath: string | null = null;
  let text: string | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file" && argv[i + 1]) {
      filePath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--text" && argv[i + 1]) {
      text = argv[i + 1];
      i += 1;
      continue;
    }
  }

  return { filePath, text };
};

const main = async (): Promise<number> => {
  const { filePath, text } = parseArgs(process.argv.slice(2));

  let script = text;
  if (!script && filePath) {
    script = readFileSync(filePath, "utf8");
  }

  if (!script) {
    script = await readFromStdin();
  }

  const result = checkScriptQuality(script ?? "");
  output.write(`${JSON.stringify(result)}\n`);

  if (!result.ok) {
    error.write(`script_quality_failed: ${result.violations.join(",")}\n`);
    return 1;
  }

  return 0;
};

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    error.write(`script_quality_check_error: ${message}\n`);
    process.exit(1);
  });
