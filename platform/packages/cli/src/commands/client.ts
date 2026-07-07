import type { Command } from "commander";
import chalk from "chalk";
import type { ApiClient } from "../api-client.js";
import {
  table,
  statusColor,
  json as jsonFmt,
} from "../formatters.js";

interface ClientRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  industryProfile: string;
  onboardingStatus: string;
  createdAt: string;
}

interface ClientsListResponse {
  clients: ClientRow[];
}

interface ClientResponse {
  client: ClientRow;
}

export function registerClientCommands(
  program: Command,
  getClient: () => ApiClient,
): void {
  const client = program
    .command("client")
    .description("Manage tenant clients");

  client
    .command("list")
    .description("List all clients")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      try {
        const apiClient = getClient();
        const data =
          await apiClient.get<ClientsListResponse>("/api/clients");

        if (opts.json) {
          console.log(jsonFmt(data));
          return;
        }

        if (data.clients.length === 0) {
          console.log(chalk.yellow("No clients found."));
          return;
        }

        const headers = [
          "ID",
          "Name",
          "Slug",
          "Plan",
          "Industry",
          "Status",
        ];
        const rows = data.clients.map((c) => [
          c.id.slice(0, 8),
          c.name,
          c.slug,
          c.plan,
          c.industryProfile,
          statusColor(c.onboardingStatus),
        ]);

        console.log(table(headers, rows));
      } catch (err) {
        console.error(
          chalk.red("Failed to fetch clients:"),
          (err as Error).message,
        );
        process.exit(1);
      }
    });

  client
    .command("add")
    .description("Add a new client")
    .requiredOption("--name <name>", "Client name")
    .requiredOption(
      "--plan <plan>",
      "Billing plan (retainer, project, hourly, annual)",
    )
    .option(
      "--slug <slug>",
      "URL slug (auto-generated from name if omitted)",
    )
    .option(
      "--industry <profile>",
      "Industry profile (fintech, healthtech, saas, ecommerce, custom)",
      "saas",
    )
    .option("--json", "Output as JSON")
    .action(
      async (opts: {
        name: string;
        plan: string;
        slug?: string;
        industry: string;
        json?: boolean;
      }) => {
        try {
          const apiClient = getClient();
          const slug =
            opts.slug ??
            opts.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");

          const data = await apiClient.post<ClientResponse>(
            "/api/clients",
            {
              name: opts.name,
              slug,
              plan: opts.plan,
              industryProfile: opts.industry,
            },
          );

          if (opts.json) {
            console.log(jsonFmt(data));
            return;
          }

          console.log(chalk.green("Client created."));
          console.log(`  ID:       ${data.client.id.slice(0, 8)}`);
          console.log(`  Name:     ${data.client.name}`);
          console.log(`  Slug:     ${data.client.slug}`);
          console.log(`  Plan:     ${data.client.plan}`);
          console.log(`  Industry: ${data.client.industryProfile}`);
          console.log(
            `  Status:   ${statusColor(data.client.onboardingStatus)}`,
          );
        } catch (err) {
          console.error(
            chalk.red("Failed to create client:"),
            (err as Error).message,
          );
          process.exit(1);
        }
      },
    );
}
