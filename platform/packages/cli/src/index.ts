#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { ApiClient } from "./api-client.js";
import { loadConfig } from "./config.js";
import { registerAuthCommands } from "./commands/auth.js";
import { registerScanCommands } from "./commands/scan.js";
import { registerFindingsCommands } from "./commands/findings.js";
import { registerComplianceCommands } from "./commands/compliance.js";
import { registerReportCommands } from "./commands/report.js";
import { registerAlertCommands } from "./commands/alerts.js";
import { registerDriftCommands } from "./commands/drift.js";
import { registerClientCommands } from "./commands/client.js";

const program = new Command();

program
  .name("blackfyre")
  .description("BLACKFYRE Security Audit Platform CLI")
  .version("0.1.0")
  .option("--api-url <url>", "Override API base URL");

function getClient(): ApiClient {
  const config = loadConfig();
  const apiUrl =
    program.opts<{ apiUrl?: string }>().apiUrl ?? config.apiUrl;
  const client = new ApiClient(apiUrl, config.token);
  return client;
}

registerAuthCommands(program, getClient);
registerScanCommands(program, getClient);
registerFindingsCommands(program, getClient);
registerComplianceCommands(program, getClient);
registerReportCommands(program, getClient);
registerAlertCommands(program, getClient);
registerDriftCommands(program, getClient);
registerClientCommands(program, getClient);

program.hook("preAction", () => {
  // For commands other than login, warn if no token is configured
  const config = loadConfig();
  const commandName = program.args[0];
  if (commandName !== "login" && !config.token) {
    console.log(
      chalk.yellow("Warning: Not authenticated. Run `blackfyre login` first."),
    );
  }
});

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(chalk.red("Error:"), (err as Error).message);
  process.exit(1);
});
