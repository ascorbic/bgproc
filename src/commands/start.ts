import { defineCommand } from "citty";
import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { addProcess, getLogPaths, ensureDataDir } from "../registry.js";

export const startCommand = defineCommand({
  meta: {
    name: "start",
    description:
      "Start a background process\n\nUsage: bgproc start -n <name> [-t <seconds>] -- <command...>",
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
  },
  run({ args, rawArgs }) {
    const name = args.name;
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

    ensureDataDir();
    const logPaths = getLogPaths(name);
    const cwd = process.cwd();

    // Open log files
    const stdoutFd = openSync(logPaths.stdout, "a");
    const stderrFd = openSync(logPaths.stderr, "a");

    // Spawn detached process
    const child = spawn(command[0]!, command.slice(1), {
      cwd,
      detached: true,
      stdio: ["ignore", stdoutFd, stderrFd],
    });

    child.unref();

    const entry = {
      pid: child.pid!,
      command,
      cwd,
      startedAt: new Date().toISOString(),
      ...(timeout && {
        timeout,
        killAt: new Date(Date.now() + timeout * 1000).toISOString(),
      }),
    };

    try {
      addProcess(name, entry);
    } catch (err) {
      // Kill the process we just started since we can't register it
      try {
        process.kill(child.pid!, "SIGTERM");
      } catch {
        // ignore
      }
      console.error((err as Error).message);
      process.exit(1);
    }

    // If timeout specified, schedule kill
    if (timeout && child.pid) {
      scheduleKill(child.pid, timeout, name);
    }

    console.log(
      JSON.stringify({
        name,
        pid: child.pid,
        cwd,
        command: command.join(" "),
        ...(timeout && { killAt: entry.killAt }),
      }),
    );
  },
});

/**
 * Fork a small process to kill after timeout
 * This survives the parent CLI exiting
 */
function scheduleKill(pid: number, seconds: number, name: string): void {
  const killer = spawn(
    process.execPath,
    [
      "-e",
      `
      setTimeout(() => {
        try {
          process.kill(${pid}, 0); // check if alive
          process.kill(${pid}, 'SIGTERM');
          console.error('bgproc: ${name} killed after ${seconds}s timeout');
        } catch {}
        process.exit(0);
      }, ${seconds * 1000});
      `,
    ],
    {
      detached: true,
      stdio: "ignore",
    },
  );
  killer.unref();
}
