import { spawn, ChildProcess } from "node:child_process";
import { openSync } from "node:fs";
import {
  addProcess,
  getLogPaths,
  ensureDataDir,
  isProcessRunning,
  type ProcessEntry,
} from "./registry.js";
import { detectPorts } from "./ports.js";

export interface SpawnResult {
  child: ChildProcess;
  entry: ProcessEntry;
  logPaths: { stdout: string; stderr: string };
}

export function spawnProcess(
  name: string,
  command: string[],
  cwd: string,
  timeout?: number,
): SpawnResult {
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

  const entry: ProcessEntry = {
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
    try {
      process.kill(child.pid!, "SIGTERM");
    } catch {
      // ignore
    }
    throw err;
  }

  if (timeout && child.pid) {
    scheduleKill(child.pid, timeout, name);
  }

  return { child, entry, logPaths };
}

export function buildStatus(
  name: string,
  entry: ProcessEntry,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    name,
    pid: entry.pid,
    cwd: entry.cwd,
    command: entry.command.join(" "),
    ...(entry.timeout && { killAt: entry.killAt }),
    ...extra,
  };
}

export interface WaitResult {
  ports?: number[];
  error?: string;
}

export async function outputStatus(
  status: Record<string, unknown>,
  pid: number,
  logPath: string,
  waitForPort: string | undefined,
  keep: boolean | undefined,
): Promise<void> {
  if (waitForPort !== undefined) {
    const waitTimeout = waitForPort ? parseInt(waitForPort, 10) : undefined;
    const killOnTimeout = !keep;
    const result = await waitForPortDetection(pid, logPath, waitTimeout, killOnTimeout);

    if (result.error) {
      console.error(result.error);
      process.exit(1);
    }

    console.log(
      JSON.stringify({
        ...status,
        ports: result.ports,
        port: result.ports![0],
      }),
    );
  } else {
    console.log(JSON.stringify(status));
  }
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
              // ignore - process may have just died
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
