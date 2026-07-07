import type { Command } from "commander";
import chalk from "chalk";
import type { ApiClient } from "../api-client.js";
import {
  table,
  statusColor,
  json as jsonFmt,
} from "../formatters.js";

interface ReportRow {
  id: string;
  type: string;
  framework: string | null;
  status: string;
  generatedAt: string;
}

interface ReportsListResponse {
  reports: ReportRow[];
}

interface ReportResponse {
  report: ReportRow;
}

export function registerReportCommands(
  program: Command,
  getClient: () => ApiClient,
): void {
  const report = program
    .command("report")
    .description("Generate and manage audit reports");

  report
    .command("generate")
    .description("Generate a new report")
    .requiredOption(
      "--type <type>",
      "Report type (readiness, gap_analysis, board_summary, evidence_package)",
    )
    .option("--framework <framework>", "Target framework (required for readiness, gap_analysis, evidence_package)")
    .option("--json", "Output as JSON")
    .action(
      async (opts: {
        type: string;
        framework?: string;
        json?: boolean;
      }) => {
        try {
          const client = getClient();
          console.log(chalk.dim("Creating report..."));

          // Step 1: Create the report record
          const createPayload: { type: string; framework?: string } = {
            type: opts.type,
          };
          if (opts.framework) {
            createPayload.framework = opts.framework;
          }

          const created = await client.post<ReportResponse>(
            "/api/reports",
            createPayload,
          );

          console.log(chalk.dim("Generating report content..."));

          // Step 2: Trigger generation
          const generated = await client.post<ReportResponse>(
            `/api/reports/${created.report.id}/generate`,
          );

          if (opts.json) {
            console.log(jsonFmt(generated));
            return;
          }

          console.log(chalk.green("Report generated successfully."));
          console.log(`  ID:        ${generated.report.id.slice(0, 8)}`);
          console.log(`  Type:      ${generated.report.type}`);
          console.log(
            `  Framework: ${generated.report.framework ?? "N/A"}`,
          );
          console.log(
            `  Status:    ${statusColor(generated.report.status)}`,
          );
        } catch (err) {
          console.error(
            chalk.red("Failed to generate report:"),
            (err as Error).message,
          );
          process.exit(1);
        }
      },
    );

  report
    .command("list")
    .description("List all reports")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      try {
        const client = getClient();
        const data =
          await client.get<ReportsListResponse>("/api/reports");

        if (opts.json) {
          console.log(jsonFmt(data));
          return;
        }

        if (data.reports.length === 0) {
          console.log(chalk.yellow("No reports found."));
          return;
        }

        const headers = [
          "ID",
          "Type",
          "Framework",
          "Status",
          "Generated",
        ];
        const rows = data.reports.map((r) => [
          r.id.slice(0, 8),
          r.type,
          r.framework ?? "-",
          statusColor(r.status),
          r.generatedAt
            ? new Date(r.generatedAt).toLocaleString()
            : "-",
        ]);

        console.log(table(headers, rows));
      } catch (err) {
        console.error(
          chalk.red("Failed to fetch reports:"),
          (err as Error).message,
        );
        process.exit(1);
      }
    });

  report
    .command("view <id>")
    .description("View report content")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean }) => {
      try {
        const client = getClient();
        const data = await client.get<{ report: ReportRow; content: unknown }>(
          `/api/reports/${id}/content`,
        );

        if (opts.json) {
          console.log(jsonFmt(data));
          return;
        }

        console.log(chalk.bold(`Report: ${data.report.type}`));
        console.log(`Status: ${statusColor(data.report.status)}`);
        console.log();
        console.log(jsonFmt(data.content));
      } catch (err) {
        console.error(
          chalk.red("Failed to fetch report:"),
          (err as Error).message,
        );
        process.exit(1);
      }
    });
}
