import { execSync } from "node:child_process";

/**
 * Get all descendant PIDs of a process (children, grandchildren, etc.)
 */
function getDescendantPids(pid: number): number[] {
  const descendants: number[] = [];
  try {
    // Get direct children using pgrep
    const output = execSync(`pgrep -P ${pid} 2>/dev/null`, {
      encoding: "utf-8",
    });
    for (const line of output.trim().split("\n")) {
      const childPid = parseInt(line, 10);
      if (!isNaN(childPid)) {
        descendants.push(childPid);
        // Recursively get grandchildren
        descendants.push(...getDescendantPids(childPid));
      }
    }
  } catch {
    // No children or pgrep failed
  }
  return descendants;
}

/**
 * Detect listening ports for a given PID and all its descendants using lsof
 */
export function detectPorts(pid: number): number[] {
  try {
    // Get all PIDs to check (the process itself plus all descendants)
    const allPids = [pid, ...getDescendantPids(pid)];
    const pidList = allPids.join(",");

    // Check all PIDs at once - lsof accepts comma-separated PIDs
    // -P = show port numbers, -n = no DNS resolution
    const output = execSync(
      `lsof -p ${pidList} -P -n 2>/dev/null | grep LISTEN`,
      {
        encoding: "utf-8",
      }
    );
    const ports: number[] = [];
    for (const line of output.split("\n")) {
      // Format: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
      // NAME is like *:3000 or 127.0.0.1:3000 or [::1]:3000
      const match = line.match(/:(\d+)\s+\(LISTEN\)/);
      if (match) {
        ports.push(parseInt(match[1], 10));
      }
    }
    return [...new Set(ports)]; // dedupe
  } catch {
    return [];
  }
}
