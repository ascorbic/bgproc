import { defineCommand } from "citty";
import { getProcess, removeProcess, isProcessRunning } from "../registry.js";

export const stopCommand = defineCommand({
  meta: {
    name: "stop",
    description: "Stop a background process",
  },
  args: {
    name: {
      type: "string",
      alias: "n",
      description: "Process name",
    },
    force: {
      type: "boolean",
      alias: "f",
      description: "Force kill (SIGKILL instead of SIGTERM)",
    },
  },
  run({ args, rawArgs }) {
    const name = args.name ?? rawArgs[0];
    if (!name) {
      console.error("Error: Process name required");
      process.exit(1);
    }
    const entry = getProcess(name);

    if (!entry) {
      console.error(`Process '${name}' not found`);
      process.exit(1);
    }

    const wasRunning = isProcessRunning(entry.pid);

    if (!wasRunning) {
      process.stderr.write(
        `Warning: Process '${name}' (PID ${entry.pid}) was already dead\n`,
      );
    } else {
      const signal = args.force ? "SIGKILL" : "SIGTERM";
      try {
        process.kill(entry.pid, signal);
      } catch (err) {
        console.error(`Failed to kill process: ${(err as Error).message}`);
        process.exit(1);
      }
    }

    removeProcess(name);

    console.log(
      JSON.stringify({
        name,
        pid: entry.pid,
        stopped: true,
        wasRunning,
        signal: wasRunning ? (args.force ? "SIGKILL" : "SIGTERM") : null,
      }),
    );
  },
});
