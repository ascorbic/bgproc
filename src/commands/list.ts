import path from "node:path";
import { defineCommand } from "citty";
import { readRegistry, isProcessRunning } from "../registry.js";
import { detectPorts } from "../ports.js";
import { formatUptime } from "../utils.js";

export const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "List all background processes",
  },
  args: {
    cwd: {
      type: "string",
      alias: "c",
      description: "Filter by cwd (no arg = current directory)",
    },
  },
  run({ args }) {
    const registry = readRegistry();

    // Handle --cwd with no value: use current directory
    // citty will set it to "" if flag present with no value
    let cwdFilter: string | undefined;
    if (args.cwd !== undefined) {
      cwdFilter = args.cwd === "" ? process.cwd() : path.resolve(args.cwd);
    }

    const entries = Object.entries(registry)
      .filter(([_, entry]) => {
        if (cwdFilter && entry.cwd !== cwdFilter) {
          return false;
        }
        return true;
      })
      .map(([name, entry]) => {
        const running = isProcessRunning(entry.pid);
        const ports = running ? detectPorts(entry.pid) : [];

        return {
          name,
          pid: entry.pid,
          running,
          ports,
          port: ports[0] ?? null,
          cwd: entry.cwd,
          command: entry.command.join(" "),
          startedAt: entry.startedAt,
          uptime: running ? formatUptime(new Date(entry.startedAt)) : null,
          ...(entry.killAt && { killAt: entry.killAt }),
        };
      });

    console.log(JSON.stringify(entries, null, 2));
  },
});
