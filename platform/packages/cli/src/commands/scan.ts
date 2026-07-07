import type { Command } from "commander";
import chalk from "chalk";
import type { ApiClient } from "../api-client.js";
import {
  table,
  statusColor,
  json as jsonFmt,
} from "../formatters.js";

interface ScanRow {
  id: string;
  status: string;
  frameworks: string[];
  targets: string[];
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
}

interface ScanResponse {
  scan: ScanRow;
  message?: string;
}

interface ScanListResponse {
  scans: ScanRow[];
}

export function registerScanCommands(
  program: Command,
  getClient: () => ApiClient,
): void {
  const scan = program
    .command("scan")
    .description("Manage security scans");

  scan
    .command("start")
    .description("Start a new security scan")
    .option(
      "--frameworks <frameworks>",
      "Comma-separated frameworks (soc2,hipaa,iso27001,gdpr,pcidss)",
      "soc2",
    )
    .option(
      "--targets <targets>",
      "Comma-separated targets (aws,azure,gcp,okta,azure_ad,google_workspace,jamf,intune,crowdstrike,network)",
      "aws",
    )
    .option("--json", "Output as JSON")
    .action(
      async (opts: {
        frameworks: string;
        targets: string;
        json?: boolean;
      }) => {
        try {
          const client = getClient();
          console.log(chalk.dim("Queueing scan..."));

          const data = await client.post<ScanResponse>("/api/scans", {
            frameworks: opts.frameworks.split(",").map((s) => s.trim()),
            targets: opts.targets.split(",").map((s) => s.trim()),
          });

          if (opts.json) {
            console.log(jsonFmt(data));
            return;
          }

          console.log(chalk.green("Scan queued successfully."));
          console.log(`  ID:         ${data.scan.id}`);
          console.log(`  Status:     ${statusColor(data.scan.status)}`);
          console.log(`  Frameworks: ${data.scan.frameworks.join(", ")}`);
          console.log(`  Targets:    ${data.scan.targets.join(", ")}`);
        } catch (err) {
          console.error(chalk.red("Failed to start scan:"), (err as Error).message);
          process.exit(1);
        }
      },
    );

  scan
    .command("status")
    .description("List all scans and their current status")
    .option("--status <status>", "Filter by status (queued,running,completed,failed,cancelled)")
    .option("--json", "Output as JSON")
    .action(async (opts: { status?: string; json?: boolean }) => {
      try {
        const client = getClient();
        const queryStr = opts.status ? `?status=${opts.status}` : "";
        const data = await client.get<ScanListResponse>(
          `/api/scans${queryStr}`,
        );

        if (opts.json) {
          console.log(jsonFmt(data));
          return;
        }

        if (data.scans.length === 0) {
          console.log(chalk.yellow("No scans found."));
          return;
        }

        const headers = ["ID", "Status", "Progress", "Frameworks", "Started", "Completed"];
        const rows = data.scans.map((s) => [
          s.id.slice(0, 8),
          statusColor(s.status),
          `${s.progress}%`,
          s.frameworks.join(","),
          s.startedAt ? new Date(s.startedAt).toLocaleString() : "-",
          s.completedAt ? new Date(s.completedAt).toLocaleString() : "-",
        ]);

        console.log(table(headers, rows));
      } catch (err) {
        console.error(chalk.red("Failed to fetch scans:"), (err as Error).message);
        process.exit(1);
      }
    });

  scan
    .command("cancel <id>")
    .description("Cancel a queued or running scan")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean }) => {
      try {
        const client = getClient();
        const data = await client.post<ScanResponse>(
          `/api/scans/${id}/cancel`,
        );

        if (opts.json) {
          console.log(jsonFmt(data));
          return;
        }

        console.log(chalk.green("Scan cancelled."));
        console.log(`  ID:     ${data.scan.id.slice(0, 8)}`);
        console.log(`  Status: ${statusColor(data.scan.status)}`);
      } catch (err) {
        console.error(chalk.red("Failed to cancel scan:"), (err as Error).message);
        process.exit(1);
      }
    });
}
