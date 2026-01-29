import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Validate process name to prevent path traversal and code injection
 */
export function validateName(name: string): void {
  if (!name) {
    throw new Error("Process name required");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error(
      "Process name must contain only alphanumeric characters, hyphens, and underscores",
    );
  }
  if (name.length > 64) {
    throw new Error("Process name must be 64 characters or less");
  }
}

export interface ProcessEntry {
  pid: number;
  command: string[];
  cwd: string;
  startedAt: string;
  timeout?: number; // seconds, if set
  killAt?: string; // ISO timestamp when to kill
}

export interface Registry {
  [name: string]: ProcessEntry;
}

function getDataDir(): string {
  return (
    process.env.BGPROC_DATA_DIR || join(homedir(), ".local", "share", "bgproc")
  );
}

function getRegistryPath(): string {
  return join(getDataDir(), "registry.json");
}

export function getLogsDir(): string {
  return join(getDataDir(), "logs");
}

export function ensureDataDir(): void {
  mkdirSync(getDataDir(), { recursive: true });
  mkdirSync(getLogsDir(), { recursive: true });
}

export function readRegistry(): Registry {
  ensureDataDir();
  const registryPath = getRegistryPath();
  if (!existsSync(registryPath)) {
    return {};
  }
  try {
    const content = readFileSync(registryPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export function writeRegistry(registry: Registry): void {
  ensureDataDir();
  writeFileSync(getRegistryPath(), JSON.stringify(registry, null, 2));
}

export function addProcess(name: string, entry: ProcessEntry): void {
  const registry = readRegistry();
  const existing = registry[name];

  if (existing) {
    if (isProcessRunning(existing.pid)) {
      throw new Error(
        `Process '${name}' is already running (PID ${existing.pid}). Use --force to restart.`,
      );
    }
    // Dead process - auto-clean old logs before starting fresh
    const logPaths = getLogPaths(name);
    try {
      if (existsSync(logPaths.stdout)) unlinkSync(logPaths.stdout);
      if (existsSync(logPaths.stderr)) unlinkSync(logPaths.stderr);
    } catch {
      // ignore
    }
  }

  registry[name] = entry;
  writeRegistry(registry);
}

export function removeProcess(name: string): void {
  const registry = readRegistry();
  delete registry[name];
  writeRegistry(registry);
}

export function getProcess(name: string): ProcessEntry | undefined {
  const registry = readRegistry();
  return registry[name];
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getLogPaths(name: string): { stdout: string; stderr: string } {
  return {
    stdout: join(getLogsDir(), `${name}.stdout.log`),
    stderr: join(getLogsDir(), `${name}.stderr.log`),
  };
}
