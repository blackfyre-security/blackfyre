import type { Command } from "commander";
import chalk from "chalk";
import type { ApiClient } from "../api-client.js";
import {
  table,
  score as scoreFmt,
  statusColor,
  json as jsonFmt,
} from "../formatters.js";

interface ScoreEntry {
  framework: string;
  score: number;
  passCount: number;
  failCount: number;
  totalControls: number;
}

interface ScoresResponse {
  scores: ScoreEntry[];
}

interface MatrixEntry {
  controlId: string;
  controlName: string;
  category: string;
  status: string;
  weight: number;
  findingIds: string[];
  evidenceCount: number;
}

interface MatrixResponse {
  matrix: {
    framework: string;
    version: string;
    score: number;
    entries: MatrixEntry[];
  };
}

interface TrendPoint {
  scanId: string;
  score: number;
  snapshotAt: string;
}

interface TrendResponse {
  trend: {
    framework: string;
    points: TrendPoint[];
  };
}

export function registerComplianceCommands(
  program: Command,
  getClient: () => ApiClient,
): void {
  const compliance = program
    .command("compliance")
    .description("View compliance scores and matrices");

  compliance
    .command("scores")
    .description("Show compliance scores across all frameworks")
    .option("--scan-id <scanId>", "Scores for a specific scan")
    .option("--json", "Output as JSON")
    .action(async (opts: { scanId?: string; json?: boolean }) => {
      try {
        const client = getClient();
        const queryStr = opts.scanId ? `?scanId=${opts.scanId}` : "";
        const data = await client.get<ScoresResponse>(
          `/api/compliance/scores${queryStr}`,
        );

        if (opts.json) {
          console.log(jsonFmt(data));
          return;
        }

        if (!data.scores || data.scores.length === 0) {
          console.log(chalk.yellow("No compliance scores available."));
          return;
        }

        const headers = [
          "Framework",
          "Score",
          "Pass",
          "Fail",
          "Total Controls",
        ];
        const rows = data.scores.map((s) => [
          s.framework.toUpperCase(),
          scoreFmt(s.score),
          String(s.passCount),
          String(s.failCount),
          String(s.totalControls),
        ]);

        console.log(table(headers, rows));
      } catch (err) {
        console.error(
          chalk.red("Failed to fetch compliance scores:"),
          (err as Error).message,
        );
        process.exit(1);
      }
    });

  compliance
    .command("matrix <framework>")
    .description("Show control-by-control compliance matrix for a framework")
    .option("--json", "Output as JSON")
    .action(async (framework: string, opts: { json?: boolean }) => {
      try {
        const client = getClient();
        const data = await client.get<MatrixResponse>(
          `/api/compliance/matrix/${framework}`,
        );

        if (opts.json) {
          console.log(jsonFmt(data));
          return;
        }

        if (!data.matrix?.entries || data.matrix.entries.length === 0) {
          console.log(
            chalk.yellow(`No controls found for ${framework.toUpperCase()}.`),
          );
          return;
        }

        console.log(
          chalk.bold(`Compliance Matrix: ${framework.toUpperCase()} (Score: ${data.matrix.score}%)`),
        );
        console.log();

        const headers = [
          "Control ID",
          "Name",
          "Category",
          "Status",
          "Findings",
        ];
        const rows = data.matrix.entries.map((c) => [
          c.controlId,
          c.controlName.length > 40
            ? c.controlName.slice(0, 37) + "..."
            : c.controlName,
          c.category,
          statusColor(c.status),
          String(c.findingIds.length),
        ]);

        console.log(table(headers, rows));
      } catch (err) {
        console.error(
          chalk.red("Failed to fetch compliance matrix:"),
          (err as Error).message,
        );
        process.exit(1);
      }
    });

  compliance
    .command("trend <framework>")
    .description("Show compliance score trend over time for a framework")
    .option("--limit <limit>", "Number of data points", "10")
    .option("--json", "Output as JSON")
    .action(
      async (
        framework: string,
        opts: { limit: string; json?: boolean },
      ) => {
        try {
          const client = getClient();
          const data = await client.get<TrendResponse>(
            `/api/compliance/trend?framework=${framework}&limit=${opts.limit}`,
          );

          if (opts.json) {
            console.log(jsonFmt(data));
            return;
          }

          if (!data.trend || !data.trend.points || data.trend.points.length === 0) {
            console.log(
              chalk.yellow(
                `No trend data for ${framework.toUpperCase()}.`,
              ),
            );
            return;
          }

          console.log(
            chalk.bold(
              `Compliance Trend: ${framework.toUpperCase()}`,
            ),
          );
          console.log();

          const headers = ["Scan", "Score", "Date"];
          const rows = data.trend.points.map((t) => [
            t.scanId.slice(0, 8),
            scoreFmt(t.score),
            new Date(t.snapshotAt).toLocaleDateString(),
          ]);

          console.log(table(headers, rows));
        } catch (err) {
          console.error(
            chalk.red("Failed to fetch compliance trend:"),
            (err as Error).message,
          );
          process.exit(1);
        }
      },
    );

  compliance
    .command("frameworks")
    .description("List available compliance frameworks")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      try {
        const client = getClient();
        const data = await client.get<{
          frameworks: {
            framework: string;
            version: string;
            totalControls: number;
          }[];
        }>("/api/compliance/frameworks");

        if (opts.json) {
          console.log(jsonFmt(data));
          return;
        }

        const headers = ["Framework", "Version", "Controls"];
        const rows = data.frameworks.map((f) => [
          f.framework.toUpperCase(),
          f.version,
          String(f.totalControls),
        ]);

        console.log(table(headers, rows));
      } catch (err) {
        console.error(
          chalk.red("Failed to fetch frameworks:"),
          (err as Error).message,
        );
        process.exit(1);
      }
    });
}
