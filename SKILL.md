---
name: bgproc
description: Manage background processes like dev servers. Use when you need to start, stop, or check status of long-running processes.
---

# bgproc

A CLI for managing background processes. All commands output JSON to stdout.

## When to Use

Use bgproc when you need to:
- Start a dev server or other long-running process in the background
- Check if a process is running and what port it's listening on
- View logs from a background process
- Stop a background process

## Commands

```bash
# Start a process
bgproc start -n <name> -- <command...>
bgproc start -n devserver -- npm run dev
bgproc start -n devserver -t 300 -- npm run dev  # auto-kill after 5 min

# Start and wait for port (recommended for dev servers)
bgproc start -n devserver -w -- npm run dev      # wait for port, then exit
bgproc start -n devserver -w 30 -- npm run dev   # wait up to 30s for port

# Force restart (kill existing process first)
bgproc start -n devserver -f -w -- npm run dev

# Check status (returns JSON with pid, running state, port)
bgproc status <name>

# View logs
bgproc logs <name>
bgproc logs <name> --tail 50
bgproc logs <name> --errors  # stderr only

# List all processes
bgproc list
bgproc list --cwd  # filter to current directory

# Stop a process
bgproc stop <name>
bgproc stop <name> --force  # SIGKILL

# Clean up dead processes
bgproc clean <name>
bgproc clean --all
```

## Workflow

1. Start a process and wait for port: `bgproc start -n devserver -w -- npm run dev`
   - Streams logs to stderr while starting
   - Prints JSON with port to stdout when ready
   - Use `-f` to force restart if already running
2. If something's wrong, check logs: `bgproc logs devserver`
3. When done: `bgproc stop devserver`

## Notes

- All commands output JSON to stdout, errors to stderr
- Port detection works via `lsof` and checks child processes (macOS/Linux only)
- Use `-w` to wait for port detection before returning
- Use `-f` to force restart (kills existing process with same name)
- Starting a process with the same name as a dead one auto-cleans it
- Logs are capped at 1MB per process
