import type { Command } from "commander";
import chalk from "chalk";
import type { ApiClient } from "../api-client.js";
import { loadConfig, saveConfig } from "../config.js";
import { json as jsonFmt } from "../formatters.js";

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; role: string };
}

export function registerAuthCommands(
  program: Command,
  getClient: () => ApiClient,
): void {
  program
    .command("login")
    .description("Authenticate with the BLACKFYRE API")
    .requiredOption("--email <email>", "Account email address")
    .requiredOption("--password <password>", "Account password")
    .option("--json", "Output as JSON")
    .action(
      async (opts: { email: string; password: string; json?: boolean }) => {
        try {
          const client = getClient();
          const data = await client.post<LoginResponse>("/api/auth/login", {
            email: opts.email,
            password: opts.password,
          });

          const config = loadConfig();
          config.token = data.accessToken;
          saveConfig(config);

          if (opts.json) {
            console.log(jsonFmt(data));
            return;
          }

          console.log(chalk.green("Login successful."));
          console.log(`  User:  ${data.user.name} (${data.user.email})`);
          console.log(`  Role:  ${data.user.role}`);
          console.log(
            chalk.dim("Token saved to ~/.ruflo-audit.json"),
          );
        } catch (err) {
          console.error(
            chalk.red("Login failed:"),
            (err as Error).message,
          );
          process.exit(1);
        }
      },
    );
}
