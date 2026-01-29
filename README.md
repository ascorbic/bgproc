# bgproc

Simple process manager for agents.

Manage background processes like dev servers from the command line. Designed to be agent-friendly with JSON output and easy status checking.

## Install

```bash
npm install -g bgproc
# or using npx
npx bgproc start -n myserver -- npm run dev
```

## Usage

```bash
# Start a process
bgproc start -n myserver -- npm run dev

# Start and wait for port to be detected (great for dev servers)
bgproc start -n myserver -w -- npm run dev
# Streams logs to stderr, prints JSON with port to stdout when ready

# Force restart (kills existing process with same name)
bgproc start -n myserver -f -w -- npm run dev

# Check status (returns JSON with port detection)
bgproc status myserver
# {"name":"myserver","pid":12345,"running":true,"port":3000,...}

# View logs
bgproc logs myserver
bgproc logs myserver --tail 50
bgproc logs myserver --follow
bgproc logs myserver --errors  # stderr only

# List all processes
bgproc list
bgproc list --cwd              # filter to current directory
bgproc list --cwd /path/to/dir # filter to specific directory

# Stop a process
bgproc stop myserver
bgproc stop myserver --force   # SIGKILL

# Clean up dead processes
bgproc clean myserver
bgproc clean --all
```

## Features

- **JSON output**: All commands output JSON to stdout, errors to stderr
- **Port detection**: Automatically detects listening ports via `lsof` (checks child processes too)
- **Wait for port**: `--wait-for-port` blocks until port is detected, streaming logs
- **Force restart**: `--force` kills existing process with same name before starting
- **Duplicate prevention**: Prevents starting multiple processes with the same name
- **Log management**: Stdout/stderr captured, capped at 1MB
- **Timeout support**: `--timeout 60` kills after N seconds
- **Auto-cleanup**: Starting a process with the same name as a dead one auto-cleans it
- **CWD filtering**: Filter process list by working directory

## Options

### `start`

```
-n, --name          Process name (required)
-f, --force         Kill existing process with same name before starting
-t, --timeout       Kill after N seconds
-w, --wait-for-port Wait for port detection (optional: timeout in seconds)
    --keep          Keep process running on wait timeout (default: kill)
```

### `status`, `stop`, `logs`, `clean`

All accept process name as positional arg or `-n`:

```bash
bgproc status myserver
bgproc status -n myserver  # equivalent
```

### `logs`

```
-t, --tail     Number of lines (default: 100)
-f, --follow   Tail the log
-e, --errors   Show stderr only
-a, --all      Show all logs
```

### `stop`

```
-f, --force    Use SIGKILL instead of SIGTERM
```

### `list`

```
-c, --cwd      Filter by directory (no arg = current dir)
```

### `clean`

```
-a, --all      Clean all dead processes
```

## Environment

- `BGPROC_DATA_DIR`: Override data directory (default: `~/.local/share/bgproc`)

## Usage with AI Agents

### Just ask the agent

The simplest approach - just tell your agent to use it:

```
Use bgproc to start and manage the dev server. Run bgproc --help to see available commands.
```

### AI Coding Assistants

Add the skill to your AI coding assistant for richer context:

```bash
npx skills add ascorbic/bgproc
```

This works with Claude Code, Cursor, Codex, and other AI coding tools.

### AGENTS.md / CLAUDE.md

For more consistent results, add to your project instructions:

```markdown
## Background Processes

Use `bgproc` to manage dev servers and background processes. All commands output JSON.

Workflow:
1. `bgproc start -n devserver -- npm run dev` - Start a process
2. `bgproc status devserver` - Check if running, get port
3. `bgproc logs devserver` - View output if something's wrong
4. `bgproc stop devserver` - Stop when done
```

## Platform Support

macOS and Linux only. Windows is not supported.

## License

MIT © Matt Kane 2026
