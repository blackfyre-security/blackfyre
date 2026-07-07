import type { Command } from "commander";
import chalk from "chalk";
import type { ApiClient } from "../api-client.js";
import { table, json as jsonFmt } from "../formatters.js";

interface AlertRuleRow {
  id: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  channels: string[];
  enabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

interface AlertsListResponse {
  alertRules: AlertRuleRow[];
}

interface AlertResponse {
  alertRule: AlertRuleRow;
}

export function registerAlertCommands(
  program: Command,
  getClient: () => ApiClient,
): void {
  const alerts = program
    .command("alerts")
    .description("Manage alert rules");

  alerts
    .command("list")
    .description("List alert rules")
    .option("--trigger-type <type>", "Filter by trigger type (severity,score_drop,drift,scan_complete,deadline,regulatory)")
    .option("--enabled <enabled>", "Filter by enabled status (true/false)")
    .option("--json", "Output as JSON")
    .action(
      async (opts: {
        triggerType?: string;
        enabled?: string;
        json?: boolean;
      }) => {
        try {
          const client = getClient();
          const params = new URLSearchParams();
          if (opts.triggerType) params.set("triggerType", opts.triggerType);
          if (opts.enabled) params.set("enabled", opts.enabled);

          const queryStr = params.toString();
          const path = queryStr
            ? `/api/alerts?${queryStr}`
            : "/api/alerts";
          const data = await client.get<AlertsListResponse>(path);

          if (opts.json) {
            console.log(jsonFmt(data));
            return;
          }

          if (data.alertRules.length === 0) {
            console.log(chalk.yellow("No alert rules found."));
            return;
          }

          const headers = [
            "ID",
            "Trigger",
            "Channels",
            "Enabled",
            "Quiet Hours",
          ];
          const rows = data.alertRules.map((r) => [
            r.id.slice(0, 8),
            r.triggerType,
            r.channels.join(", "),
            r.enabled ? chalk.green("yes") : chalk.red("no"),
            r.quietHoursStart && r.quietHoursEnd
              ? `${r.quietHoursStart}-${r.quietHoursEnd}`
              : "-",
          ]);

          console.log(table(headers, rows));
        } catch (err) {
          console.error(
            chalk.red("Failed to fetch alerts:"),
            (err as Error).message,
          );
          process.exit(1);
        }
      },
    );

  alerts
    .command("create")
    .description("Create a new alert rule")
    .requiredOption(
      "--trigger-type <type>",
      "Trigger type (severity, score_drop, drift, scan_complete, deadline, regulatory)",
    )
    .requiredOption(
      "--channels <channels>",
      "Comma-separated channels (email,slack,webhook,sms)",
    )
    .option("--severity <severity>", "Severity threshold for severity trigger")
    .option("--threshold <threshold>", "Numeric threshold for score_drop trigger")
    .option("--quiet-start <time>", "Quiet hours start (HH:MM)")
    .option("--quiet-end <time>", "Quiet hours end (HH:MM)")
    .option("--json", "Output as JSON")
    .action(
      async (opts: {
        triggerType: string;
        channels: string;
        severity?: string;
        threshold?: string;
        quietStart?: string;
        quietEnd?: string;
        json?: boolean;
      }) => {
        try {
          const client = getClient();
          const triggerConfig: Record<string, unknown> = {};
          if (opts.severity) triggerConfig.severity = opts.severity;
          if (opts.threshold)
            triggerConfig.threshold = Number(opts.threshold);

          const payload: Record<string, unknown> = {
            triggerType: opts.triggerType,
            triggerConfig,
            channels: opts.channels.split(",").map((s) => s.trim()),
          };
          if (opts.quietStart) payload.quietHoursStart = opts.quietStart;
          if (opts.quietEnd) payload.quietHoursEnd = opts.quietEnd;

          const data = await client.post<AlertResponse>(
            "/api/alerts",
            payload,
          );

          if (opts.json) {
            console.log(jsonFmt(data));
            return;
          }

          console.log(chalk.green("Alert rule created."));
          console.log(`  ID:       ${data.alertRule.id.slice(0, 8)}`);
          console.log(`  Trigger:  ${data.alertRule.triggerType}`);
          console.log(
            `  Channels: ${data.alertRule.channels.join(", ")}`,
          );
          console.log(
            `  Enabled:  ${data.alertRule.enabled ? chalk.green("yes") : chalk.red("no")}`,
          );
        } catch (err) {
          console.error(
            chalk.red("Failed to create alert:"),
            (err as Error).message,
          );
          process.exit(1);
        }
      },
    );
}
