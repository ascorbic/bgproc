import { defineCommand } from "citty";
import { spawn, ChildProcess } from "node:child_process";
import { openSync } from "node:fs";
import { addProcess, getProcess, removeProcess, getLogPaths, ensureDataDir, validateName, isProcessRunning } from "../registry.js";
import { detectPorts } from "../ports.js";

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

    const baseStatus = {
      name,
      pid: child.pid,
      cwd,
      command: command.join(" "),
      ...(timeout && { killAt: entry.killAt }),
    };

    // If --wait-for-port, wait for port detection before printing final status
    if (args.waitForPort !== undefined) {
      const waitTimeout = args.waitForPort ? parseInt(args.waitForPort, 10) : undefined;
      const killOnTimeout = !args.keep;
      const result = await waitForPortDetection(child.pid!, logPaths.stdout, waitTimeout, killOnTimeout);

      if (result.error) {
        console.error(result.error);
        process.exit(1);
      }

      console.log(
        JSON.stringify({
          ...baseStatus,
          ports: result.ports,
          port: result.ports![0],
        }),
      );
    } else {
      console.log(JSON.stringify(baseStatus));
    }
  },
});

interface WaitResult {
  ports?: number[];
  error?: string;
}

/**
 * Wait for a port to be detected on the process.
 * Tails logs to stderr while waiting.
 */
function waitForPortDetection(
  pid: number,
  logPath: string,
  timeoutSeconds?: number,
  killOnTimeout?: boolean
): Promise<WaitResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    // Tail the log file to stderr so user sees output
    const tail = spawn("tail", ["-f", logPath], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    tail.stdout?.pipe(process.stderr);

    const cleanup = (tailProcess: ChildProcess, intervalId: NodeJS.Timeout) => {
      clearInterval(intervalId);
      tailProcess.kill();
    };

    const pollInterval = setInterval(() => {
      // Check if process is still running
      if (!isProcessRunning(pid)) {
        cleanup(tail, pollInterval);
        resolve({ error: `Process ${pid} died before a port was detected` });
        return;
      }

      // Check for timeout
      if (timeoutSeconds !== undefined) {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed >= timeoutSeconds) {
          cleanup(tail, pollInterval);
          if (killOnTimeout) {
            try {
              process.kill(pid, "SIGTERM");
            } catch {
              // ignore - process may have just died
            }
            resolve({ error: `Timeout: no port detected after ${timeoutSeconds}s (process killed)` });
          } else {
            resolve({ error: `Timeout: no port detected after ${timeoutSeconds}s (process still running)` });
          }
          return;
        }
      }

      // Check for ports
      const ports = detectPorts(pid);
      if (ports.length > 0) {
        cleanup(tail, pollInterval);
        resolve({ ports });
      }
    }, 500);
  });
}

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
          console.error('bgproc: ' + process.env.BGPROC_NAME + ' killed after ${seconds}s timeout');
        } catch {}
        process.exit(0);
      }, ${seconds * 1000});
      `,
    ],
    {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, BGPROC_NAME: name },
    },
  );
  killer.unref();
}
