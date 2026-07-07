import type { Command } from "commander";
import chalk from "chalk";
import type { ApiClient } from "../api-client.js";
import {
  table,
  severityColor,
  json as jsonFmt,
} from "../formatters.js";

interface DriftEvent {
  id: string;
  integrationId: string;
  changeType: string;
  severity: string;
  resourceType: string;
  resourceId: string;
  previousValue: unknown;
  currentValue: unknown;
  acknowledged: boolean;
  detectedAt: string;
}

interface DriftListResponse {
  driftEvents: DriftEvent[];
}

interface DriftStatsResponse {
  stats: {
    total: number;
    unacknowledged: number;
    bySeverity: Record<string, number>;
    byChangeType: Record<string, number>;
  };
}

export function registerDriftCommands(
  program: Command,
  getClient: () => ApiClient,
): void {
  const drift = program
    .command("drift")
    .description("View configuration drift events");

  drift
    .command("list")
    .description("List drift events")
    .option("--severity <severity>", "Filter by severity (critical,high,medium,low,info)")
    .option("--change-type <type>", "Filter by change type")
    .option("--acknowledged <bool>", "Filter by acknowledged (true/false)")
    .option("--json", "Output as JSON")
    .action(
      async (opts: {
        severity?: string;
        changeType?: string;
        acknowledged?: string;
        json?: boolean;
      }) => {
        try {
          const client = getClient();
          const params = new URLSearchParams();
          if (opts.severity) params.set("severity", opts.severity);
          if (opts.changeType) params.set("changeType", opts.changeType);
          if (opts.acknowledged)
            params.set("acknowledged", opts.acknowledged);

          const queryStr = params.toString();
          const path = queryStr
            ? `/api/drift?${queryStr}`
            : "/api/drift";
          const data = await client.get<DriftListResponse>(path);

          if (opts.json) {
            console.log(jsonFmt(data));
            return;
          }

          if (data.driftEvents.length === 0) {
            console.log(chalk.yellow("No drift events found."));
            return;
          }

          const headers = [
            "ID",
            "Severity",
            "Change Type",
            "Resource",
            "Acknowledged",
            "Detected",
          ];
          const rows = data.driftEvents.map((e) => [
            e.id.slice(0, 8),
            severityColor(e.severity),
            e.changeType,
            `${e.resourceType}/${e.resourceId.slice(0, 12)}`,
            e.acknowledged ? chalk.green("yes") : chalk.red("no"),
            new Date(e.detectedAt).toLocaleString(),
          ]);

          console.log(table(headers, rows));
        } catch (err) {
          console.error(
            chalk.red("Failed to fetch drift events:"),
            (err as Error).message,
          );
          process.exit(1);
        }
      },
    );

  drift
    .command("stats")
    .description("Show drift statistics summary")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      try {
        const client = getClient();
        const data =
          await client.get<DriftStatsResponse>("/api/drift/stats");

        if (opts.json) {
          console.log(jsonFmt(data));
          return;
        }

        const stats = data.stats;
        console.log(chalk.bold("Drift Statistics"));
        console.log();
        console.log(`  Total events:        ${stats.total}`);
        console.log(
          `  Unacknowledged:      ${stats.unacknowledged > 0 ? chalk.red(String(stats.unacknowledged)) : chalk.green("0")}`,
        );
        console.log();

        if (stats.bySeverity && Object.keys(stats.bySeverity).length > 0) {
          console.log(chalk.bold("  By Severity:"));
          for (const [sev, cnt] of Object.entries(stats.bySeverity)) {
            console.log(
              `    ${severityColor(sev).padEnd(20)} ${cnt}`,
            );
          }
        }

        if (
          stats.byChangeType &&
          Object.keys(stats.byChangeType).length > 0
        ) {
          console.log();
          console.log(chalk.bold("  By Change Type:"));
          for (const [type, cnt] of Object.entries(stats.byChangeType)) {
            console.log(`    ${type.padEnd(20)} ${cnt}`);
          }
        }
      } catch (err) {
        console.error(
          chalk.red("Failed to fetch drift stats:"),
          (err as Error).message,
        );
        process.exit(1);
      }
    });
}
