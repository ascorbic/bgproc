import { defineCommand } from "citty";
import { spawn, ChildProcess } from "node:child_process";
import { openSync } from "node:fs";
import {
  getProcess,
  removeProcess,
  addProcess,
  getLogPaths,
  ensureDataDir,
  validateName,
  isProcessRunning,
} from "../registry.js";
import { detectPorts } from "../ports.js";

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

    // Restart with same command and cwd
    const { command, cwd, timeout } = existing;

    ensureDataDir();
    const logPaths = getLogPaths(name);

    const stdoutFd = openSync(logPaths.stdout, "a");
    const stderrFd = openSync(logPaths.stderr, "a");

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

    addProcess(name, entry);

    // If timeout was set on original, schedule kill again
    if (timeout && child.pid) {
      scheduleKill(child.pid, timeout, name);
    }

    const baseStatus = {
      name,
      pid: child.pid,
      cwd,
      command: command.join(" "),
      restarted: true,
      ...(timeout && { killAt: entry.killAt }),
    };

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

function waitForPortDetection(
  pid: number,
  logPath: string,
  timeoutSeconds?: number,
  killOnTimeout?: boolean,
): Promise<WaitResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const tail = spawn("tail", ["-f", logPath], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    tail.stdout?.pipe(process.stderr);

    const cleanup = (tailProcess: ChildProcess, intervalId: NodeJS.Timeout) => {
      clearInterval(intervalId);
      tailProcess.kill();
    };

    const pollInterval = setInterval(() => {
      if (!isProcessRunning(pid)) {
        cleanup(tail, pollInterval);
        resolve({ error: `Process ${pid} died before a port was detected` });
        return;
      }

      if (timeoutSeconds !== undefined) {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed >= timeoutSeconds) {
          cleanup(tail, pollInterval);
          if (killOnTimeout) {
            try {
              process.kill(pid, "SIGTERM");
            } catch {
              // ignore
            }
            resolve({ error: `Timeout: no port detected after ${timeoutSeconds}s (process killed)` });
          } else {
            resolve({ error: `Timeout: no port detected after ${timeoutSeconds}s (process still running)` });
          }
          return;
        }
      }

      const ports = detectPorts(pid);
      if (ports.length > 0) {
        cleanup(tail, pollInterval);
        resolve({ ports });
      }
    }, 500);
  });
}

function scheduleKill(pid: number, seconds: number, name: string): void {
  const killer = spawn(
    process.execPath,
    [
      "-e",
      `
      setTimeout(() => {
        try {
          process.kill(${pid}, 0);
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
