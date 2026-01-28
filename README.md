# bgproc

Simple process manager for agents.

Manage background processes like dev servers from the command line. Designed to be agent-friendly with JSON output and easy status checking.

## Install

```bash
npm install -g bgproc
```

## Usage

```bash
# Start a process
bgproc start -n myserver -- npm run dev

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
- **Port detection**: Automatically detects listening ports via `lsof`
- **Duplicate prevention**: Prevent starting multiple processes with the same name
- **Log management**: Stdout/stderr captured, capped at 1MB
- **Timeout support**: `--timeout 60` kills after N seconds
- **Auto-cleanup**: Starting a process with the same name as a dead one auto-cleans it
- **CWD filtering**: Filter process list by working directory

## Options

### `start`

```
-n, --name     Process name (required)
-t, --timeout  Kill after N seconds
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

## License

MIT
