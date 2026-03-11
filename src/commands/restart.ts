import { defineCommand } from "citty";
import { getProcess, removeProcess, validateName, isProcessRunning } from "../registry.js";
import { spawnProcess, buildStatus, outputStatus } from "../process.js";

export const restartCommand = defineCommand({
  meta: {
    name: "restart",
    description:
      "Restart a background process with the same command and cwd\n\nUsage: bgproc restart <name> [-w [<seconds>]] [--keep]",
  },
  args: {
    name: {
      type: "string",
      alias: "n",
      description: "Process name",
    },
    waitForPort: {
      type: "string",
      alias: "w",
      description: "Wait for port to be detected (optional: timeout in seconds)",
    },
    keep: {
      type: "boolean",
      description: "Keep process running on timeout (only with --wait-for-port)",
    },
  },
  async run({ args, rawArgs }) {
    const name = args.name ?? rawArgs[0];

    try {
      validateName(name);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }

    if (args.keep && args.waitForPort === undefined) {
      console.error("Error: --keep requires --wait-for-port");
      process.exit(1);
    }

    const existing = getProcess(name);
    if (!existing) {
      console.error(`Process '${name}' not found`);
      process.exit(1);
    }

    // Kill if running
    if (isProcessRunning(existing.pid)) {
      try {
        process.kill(existing.pid, "SIGTERM");
      } catch {
        // ignore - process may have just died
      }
    }

    removeProcess(name);

    const { command, cwd, timeout } = existing;
    const result = spawnProcess(name, command, cwd, timeout);

    const status = buildStatus(name, result.entry, { restarted: true });
    await outputStatus(status, result.child.pid!, result.logPaths.stdout, args.waitForPort, args.keep);
  },
});
