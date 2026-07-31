import fs from "node:fs";
import path from "node:path";

interface AppConfig {
  excludeArchived: boolean;
  collectLimitPerRepo: number;
  refreshMinutes: number;
}

const DEFAULTS: AppConfig = {
  excludeArchived: true,
  collectLimitPerRepo: 100,
  refreshMinutes: 15,
};

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;
  const p = path.join(process.cwd(), "config.json");
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    cached = { ...DEFAULTS, ...raw };
  } catch {
    cached = { ...DEFAULTS };
  }
  return cached!;
}
