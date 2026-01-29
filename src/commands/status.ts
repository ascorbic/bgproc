import { defineCommand } from "citty";
import { getProcess, isProcessRunning, validateName } from "../registry.js";
import { detectPorts } from "../ports.js";
import { formatUptime } from "../utils.js";

export const statusCommand = defineCommand({
  meta: {
    name: "status",
    description: "Get status of a background process, including pid and open ports",
  },
  args: {
    name: {
      type: "string",
      alias: "n",
      description: "Process name",
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

    const running = isProcessRunning(entry.pid);
    const ports = running ? detectPorts(entry.pid) : [];

    const uptime = running ? formatUptime(new Date(entry.startedAt)) : null;

    console.log(
      JSON.stringify({
        name,
        pid: entry.pid,
        running,
        ports,
        port: ports[0] ?? null, // convenience: first port
        cwd: entry.cwd,
        command: entry.command.join(" "),
        startedAt: entry.startedAt,
        uptime,
        ...(entry.killAt && { killAt: entry.killAt }),
      }),
    );
  },
});
