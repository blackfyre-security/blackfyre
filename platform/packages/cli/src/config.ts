import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_PATH = join(homedir(), ".blackfyre.json");

export interface CliConfig {
  apiUrl: string;
  token?: string;
}

export function loadConfig(): CliConfig {
  if (existsSync(CONFIG_PATH)) {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as CliConfig;
  }
  return { apiUrl: "http://localhost:3000" };
}

export function saveConfig(config: CliConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
