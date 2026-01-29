import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI = join(import.meta.dirname, "../dist/cli.mjs");

// Use a temp directory for test data to avoid polluting user's real bgproc data
const TEST_DATA_DIR = join(tmpdir(), "bgproc-test-" + process.pid);

function run(args: string): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execSync(`node ${CLI} ${args}`, {
      encoding: "utf-8",
      env: {
        ...process.env,
        BGPROC_DATA_DIR: TEST_DATA_DIR,
      },
    });
    return { stdout, stderr: "", status: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      status: err.status || 1,
    };
  }
}

function parseJson(output: string): any {
  return JSON.parse(output.trim());
}

describe("bgproc CLI", () => {
  beforeEach(() => {
    // Clean test data dir
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true });
    }
    mkdirSync(TEST_DATA_DIR, { recursive: true });
  });

  afterEach(() => {
    // Stop any processes we started
    try {
      const result = run("list");
      if (result.status === 0) {
        const procs = parseJson(result.stdout);
        for (const proc of procs) {
          run(`stop ${proc.name}`);
        }
      }
    } catch {
      // ignore
    }

    // Clean up
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true });
    }
  });

  describe("start", () => {
    it("starts a process and returns JSON", () => {
      const result = run("start -n test-sleep -- sleep 60");
      expect(result.status).toBe(0);

      const data = parseJson(result.stdout);
      expect(data.name).toBe("test-sleep");
      expect(data.pid).toBeTypeOf("number");
      expect(data.command).toBe("sleep 60");
    });

    it("fails when name is already running", () => {
      run("start -n duplicate -- sleep 60");
      const result = run("start -n duplicate -- sleep 60");

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("already running");
    });

    it("auto-cleans dead process with same name", async () => {
      // Start a process that exits immediately
      run("start -n reuse-test -- node -e 'process.exit(0)'");
      await new Promise((r) => setTimeout(r, 200));

      // Starting again should succeed (auto-clean)
      const result = run("start -n reuse-test -- sleep 60");
      expect(result.status).toBe(0);
      const data = JSON.parse(result.stdout);
      expect(data.name).toBe("reuse-test");
    });

    it("fails without a command", () => {
      const result = run("start -n no-cmd");
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("No command specified");
    });

    it("rejects invalid process names", () => {
      const invalid = run("start -n '../evil' -- sleep 60");
      expect(invalid.status).toBe(1);
      expect(invalid.stderr).toContain("alphanumeric");

      const spaces = run("start -n 'has spaces' -- sleep 60");
      expect(spaces.status).toBe(1);
      expect(spaces.stderr).toContain("alphanumeric");
    });
  });

  describe("status", () => {
    it("returns status of running process", () => {
      run("start -n status-test -- sleep 60");
      const result = run("status status-test");

      expect(result.status).toBe(0);
      const data = parseJson(result.stdout);
      expect(data.name).toBe("status-test");
      expect(data.running).toBe(true);
      expect(data.pid).toBeTypeOf("number");
    });

    it("fails for unknown process", () => {
      const result = run("status nonexistent");
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("not found");
    });
  });

  describe("list", () => {
    it("returns empty array when no processes", () => {
      const result = run("list");
      expect(result.status).toBe(0);

      const data = parseJson(result.stdout);
      expect(data).toEqual([]);
    });

    it("lists running processes", () => {
      run("start -n list-test-1 -- sleep 60");
      run("start -n list-test-2 -- sleep 60");

      const result = run("list");
      expect(result.status).toBe(0);

      const data = parseJson(result.stdout);
      expect(data).toHaveLength(2);
      expect(data.map((p: any) => p.name).sort()).toEqual([
        "list-test-1",
        "list-test-2",
      ]);
    });
  });

  describe("stop", () => {
    it("stops a running process", () => {
      run("start -n stop-test -- sleep 60");
      const result = run("stop stop-test");

      expect(result.status).toBe(0);
      const data = parseJson(result.stdout);
      expect(data.stopped).toBe(true);
      expect(data.wasRunning).toBe(true);

      // Verify it's gone from list
      const listResult = run("list");
      const list = parseJson(listResult.stdout);
      expect(list).toEqual([]);
    });

    it("reports when process already dead", () => {
      run("start -n dead-test -- sleep 0.1");
      // Wait for it to die
      execSync("sleep 0.5");

      const result = run("stop dead-test");
      expect(result.status).toBe(0);
      const data = parseJson(result.stdout);
      expect(data.wasRunning).toBe(false);
    });

    it("fails for unknown process", () => {
      const result = run("stop nonexistent");
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("not found");
    });
  });

  describe("clean", () => {
    it("cleans dead processes", () => {
      run("start -n clean-test -- sleep 0.1");
      execSync("sleep 0.5");

      const result = run("clean clean-test");
      expect(result.status).toBe(0);

      const data = parseJson(result.stdout);
      expect(data.cleaned).toContain("clean-test");
    });

    it("refuses to clean running process", () => {
      run("start -n running-clean -- sleep 60");
      const result = run("clean running-clean");

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("still running");
    });

    it("cleans all dead with --all", () => {
      run("start -n dead1 -- sleep 0.1");
      run("start -n dead2 -- sleep 0.1");
      run("start -n alive -- sleep 60");
      execSync("sleep 0.5");

      const result = run("clean --all");
      expect(result.status).toBe(0);

      const data = parseJson(result.stdout);
      expect(data.cleaned.sort()).toEqual(["dead1", "dead2"]);

      // Alive should still be there
      const listResult = run("list");
      const list = parseJson(listResult.stdout);
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe("alive");
    });
  });

  describe("timeout", () => {
    it("kills process after timeout", async () => {
      run("start -n timeout-test -t 1 -- sleep 60");

      const statusBefore = run("status timeout-test");
      expect(parseJson(statusBefore.stdout).running).toBe(true);

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const statusAfter = run("status timeout-test");
      expect(parseJson(statusAfter.stdout).running).toBe(false);
    });
  });

  describe("logs", () => {
    it("shows process output", () => {
      run("start -n echo-test -- sh -c 'echo hello world'");
      execSync("sleep 0.3");

      const result = run("logs echo-test");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("hello world");
    });

    it("shows stderr with --errors", () => {
      run("start -n stderr-test -- sh -c 'echo error >&2'");
      execSync("sleep 0.3");

      const result = run("logs stderr-test --errors");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("error");
    });

    it("fails for unknown process", () => {
      const result = run("logs nonexistent");
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("not found");
    });
  });

  describe("port detection", () => {
    it("detects listening port", async () => {
      run("start -n server-test -- python3 -m http.server 19876");
      // Give it time to start listening
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result = run("status server-test");
      expect(result.status).toBe(0);

      const data = parseJson(result.stdout);
      expect(data.running).toBe(true);
      expect(data.port).toBe(19876);
    });
  });

  describe("wait-for-port", () => {
    it("waits for port and returns JSON with port", () => {
      const result = run("start -n wait-test -w -- python3 -m http.server 19877");
      expect(result.status).toBe(0);

      const data = parseJson(result.stdout);
      expect(data.name).toBe("wait-test");
      expect(data.port).toBe(19877);
      expect(data.ports).toContain(19877);
    });

    it("kills process on timeout by default", async () => {
      const result = run("start -n timeout-kill -w 1 -- sleep 60");
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("process killed");

      // Verify process is dead
      await new Promise((r) => setTimeout(r, 100));
      const status = run("status timeout-kill");
      expect(parseJson(status.stdout).running).toBe(false);
    });

    it("keeps process running on timeout with --keep", async () => {
      const result = run("start -n timeout-keep -w 1 --keep -- sleep 60");
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("still running");

      // Verify process is still alive
      const status = run("status timeout-keep");
      expect(parseJson(status.stdout).running).toBe(true);
    });

    it("errors when --keep used without --wait-for-port", () => {
      const result = run("start -n keep-error --keep -- sleep 60");
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("--keep requires --wait-for-port");
    });
  });

  describe("force", () => {
    it("kills existing process with --force", () => {
      const first = run("start -n force-test -- sleep 60");
      expect(first.status).toBe(0);
      const firstPid = parseJson(first.stdout).pid;

      const second = run("start -n force-test -f -- sleep 60");
      expect(second.status).toBe(0);
      const secondPid = parseJson(second.stdout).pid;

      expect(secondPid).not.toBe(firstPid);

      // Verify new process is running
      const status = run("status force-test");
      expect(parseJson(status.stdout).pid).toBe(secondPid);
      expect(parseJson(status.stdout).running).toBe(true);
    });
  });
});
