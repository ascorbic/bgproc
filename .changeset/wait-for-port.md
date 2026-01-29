---
"bgproc": minor
---

Add `--wait-for-port` flag to `start` command that waits for port detection before exiting. Optionally accepts a timeout in seconds. By default, kills the process on timeout; use `--keep` to leave it running.
