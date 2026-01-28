import { defineCommand } from "citty";
import { unlinkSync, existsSync } from "node:fs";
import {
  readRegistry,
  removeProcess,
  isProcessRunning,
  getLogPaths,
  validateName,
} from "../registry.js";

export const cleanCommand = defineCommand({
  meta: {
    name: "clean",
    description: "Remove dead processes and their logs",
  },
  args: {
    name: {
      type: "string",
      alias: "n",
      description: "Process name",
    },
    all: {
      type: "boolean",
      alias: "a",
      description: "Clean all dead processes",
    },
  },
  run({ args, rawArgs }) {
    const registry = readRegistry();
    const cleaned: string[] = [];
    const name = args.name ?? rawArgs[0];

    if (args.all) {
      // Clean all dead processes
      for (const [procName, entry] of Object.entries(registry)) {
        if (!isProcessRunning(entry.pid)) {
          cleanProcess(procName);
          cleaned.push(procName);
        }
      }
    } else if (name) {
      try {
        validateName(name);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      const entry = registry[name];

      if (!entry) {
        console.error(`Process '${name}' not found`);
        process.exit(1);
      }

      if (isProcessRunning(entry.pid)) {
        console.error(
          `Process '${name}' is still running. Use 'bgproc stop ${name}' first.`,
        );
        process.exit(1);
      }

      cleanProcess(name);
      cleaned.push(name);
    } else {
      console.error("Specify a process name or use --all");
      process.exit(1);
    }

    console.log(
      JSON.stringify({
        cleaned,
        count: cleaned.length,
      }),
    );
  },
});

function cleanProcess(name: string): void {
  removeProcess(name);

  const logPaths = getLogPaths(name);
  try {
    if (existsSync(logPaths.stdout)) unlinkSync(logPaths.stdout);
    if (existsSync(logPaths.stderr)) unlinkSync(logPaths.stderr);
  } catch {
    // ignore
  }
}
