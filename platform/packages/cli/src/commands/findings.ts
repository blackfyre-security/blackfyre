import type { Command } from "commander";
import chalk from "chalk";
import type { ApiClient } from "../api-client.js";
import {
  table,
  severityColor,
  statusColor,
  json as jsonFmt,
} from "../formatters.js";

interface FindingRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  category: string;
  resourceType: string | null;
  resourceId: string | null;
}

interface FindingsResponse {
  findings: FindingRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function registerFindingsCommands(
  program: Command,
  getClient: () => ApiClient,
): void {
  program
    .command("findings")
    .description("List security findings")
    .option(
      "--severity <severity>",
      "Filter by severity (critical,high,medium,low,info)",
    )
    .option(
      "--status <status>",
      "Filter by status (open,acknowledged,in_progress,resolved,dismissed)",
    )
    .option("--category <category>", "Filter by category")
    .option("--scan-id <scanId>", "Filter by scan ID")
    .option("--page <page>", "Page number", "1")
    .option("--limit <limit>", "Results per page", "25")
    .option("--json", "Output as JSON")
    .action(
      async (opts: {
        severity?: string;
        status?: string;
        category?: string;
        scanId?: string;
        page: string;
        limit: string;
        json?: boolean;
      }) => {
        try {
          const client = getClient();
          const params = new URLSearchParams();
          if (opts.severity) params.set("severity", opts.severity);
          if (opts.status) params.set("status", opts.status);
          if (opts.category) params.set("category", opts.category);
          if (opts.scanId) params.set("scanId", opts.scanId);
          params.set("page", opts.page);
          params.set("limit", opts.limit);

          const queryStr = params.toString();
          const data = await client.get<FindingsResponse>(
            `/api/findings?${queryStr}`,
          );

          if (opts.json) {
            console.log(jsonFmt(data));
            return;
          }

          if (data.findings.length === 0) {
            console.log(chalk.yellow("No findings found."));
            return;
          }

          const headers = [
            "ID",
            "Severity",
            "Status",
            "Category",
            "Title",
          ];
          const rows = data.findings.map((f) => [
            f.id.slice(0, 8),
            severityColor(f.severity),
            statusColor(f.status),
            f.category,
            f.title.length > 50 ? f.title.slice(0, 47) + "..." : f.title,
          ]);

          console.log(table(headers, rows));
          console.log(
            chalk.dim(
              `\nPage ${data.pagination.page}/${data.pagination.totalPages} (${data.pagination.total} total)`,
            ),
          );
        } catch (err) {
          console.error(
            chalk.red("Failed to fetch findings:"),
            (err as Error).message,
          );
          process.exit(1);
        }
      },
    );
}
