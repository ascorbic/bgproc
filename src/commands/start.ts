import { defineCommand } from "citty";
import { getProcess, removeProcess, validateName, isProcessRunning } from "../registry.js";
import { spawnProcess, buildStatus, outputStatus } from "../process.js";

export const startCommand = defineCommand({
  meta: {
    name: "start",
    description:
      "Start a background process\n\nUsage: bgproc start -n <name> [-f] [-t <seconds>] [-w [<seconds>]] [--keep] -- <command...>",
  },
  args: {
    name: {
      type: "string",
      alias: "n",
      description: "Name for the process",
      required: true,
    },
    timeout: {
      type: "string",
      alias: "t",
      description: "Kill after N seconds",
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
    force: {
      type: "boolean",
      alias: "f",
      description: "Kill existing process with same name before starting",
    },
  },
  async run({ args, rawArgs }) {
    const name = args.name;

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

    // If --force, kill any existing process with this name
    if (args.force) {
      const existing = getProcess(name);
      if (existing && isProcessRunning(existing.pid)) {
        try {
          process.kill(existing.pid, "SIGTERM");
        } catch {
          // ignore - process may have just died
        }
        removeProcess(name);
      }
    }

    const timeout = args.timeout ? parseInt(args.timeout, 10) : undefined;

    // Get command from rawArgs after "--"
    const dashDashIdx = rawArgs.indexOf("--");
    const command = dashDashIdx >= 0 ? rawArgs.slice(dashDashIdx + 1) : [];

    if (command.length === 0) {
      console.error(
        "Error: No command specified. Use: bgproc start -n <name> -- <command>",
      );
      process.exit(1);
    }

    let result;
    try {
      result = spawnProcess(name, command, process.cwd(), timeout);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }

    const status = buildStatus(name, result.entry);
    await outputStatus(status, result.child.pid!, result.logPaths.stdout, args.waitForPort, args.keep);
  },
});
