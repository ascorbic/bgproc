---
"bgproc": patch
---

Fix port detection to check descendant processes, not just the main PID. This fixes detection for dev servers that spawn child processes to listen on ports.
