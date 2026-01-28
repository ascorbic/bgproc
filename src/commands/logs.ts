import { defineCommand } from "citty";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { getProcess, getLogPaths, validateName } from "../registry.js";
import { readLastLines, readLog } from "../logs.js";

export const logsCommand = defineCommand({
  meta: {
    name: "logs",
    description: "View logs for a background process",
  },
  args: {
    name: {
      type: "string",
      alias: "n",
      description: "Process name",
    },
    tail: {
      type: "string",
      alias: "t",
      description: "Number of lines to show (default: 100)",
    },
    follow: {
      type: "boolean",
      alias: "f",
      description: "Follow log output (tail -f)",
    },
    errors: {
      type: "boolean",
      alias: "e",
      description: "Show only stderr",
    },
    all: {
      type: "boolean",
      alias: "a",
      description: "Show all logs (no line limit)",
    },
  },
  run({ args, rawArgs }) {
    const name = args.name ?? rawArgs[0];

    try {
      validateName(name);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }

    const entry = getProcess(name);

    if (!entry) {
      console.error(`Process '${name}' not found`);
      process.exit(1);
    }

    const logPaths = getLogPaths(name);
    const logPath = args.errors ? logPaths.stderr : logPaths.stdout;

    if (!existsSync(logPath)) {
      console.error(`No logs found for '${name}'`);
      process.exit(1);
    }

    if (args.follow) {
      // Use tail -f for follow mode
      const tail = spawn("tail", ["-f", logPath], {
        stdio: "inherit",
      });

      process.on("SIGINT", () => {
        tail.kill();
        process.exit(0);
      });

      return;
    }

    if (args.all) {
      const content = readLog(logPath);
      process.stdout.write(content);
      return;
    }

    const lines = parseInt(args.tail ?? "100", 10);
    const output = readLastLines(logPath, lines);
    console.log(output.join("\n"));
  },
});
