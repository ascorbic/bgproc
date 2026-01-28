import { defineCommand } from "citty";
import { getProcess, isProcessRunning, getLogPaths, validateName } from "../registry.js";
import { detectPorts, detectPortFromLogs } from "../ports.js";

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
    const logPaths = getLogPaths(name);

    let ports: number[] = [];
    if (running) {
      ports = detectPorts(entry.pid);
      // Fallback to log parsing if lsof didn't find anything
      if (ports.length === 0) {
        const logPort = detectPortFromLogs(logPaths.stdout);
        if (logPort) ports = [logPort];
      }
    }

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

function formatUptime(startedAt: Date): string {
  const seconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h${mins}m`;
}
