# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
pnpm build          # Build with tsdown (outputs to dist/)
pnpm dev            # Build in watch mode
pnpm test           # Run tests in watch mode
pnpm test run       # Run tests once
pnpm lint           # Run oxlint
pnpm lint:fix       # Run oxlint with auto-fix
pnpm format         # Format with oxfmt
```

Tests require a build first (`pnpm build`) since they run against `dist/cli.mjs`.

## Architecture

This is a CLI tool that manages background processes, designed for agent use with JSON output.

**Entry point**: `src/cli.ts` - Uses [citty](https://github.com/unjs/citty) for command parsing

**Core modules**:
- `src/registry.ts` - Process registry stored in `~/.local/share/bgproc/registry.json`. Tracks PIDs, commands, cwds, and timeouts.
- `src/logs.ts` - Log file management with 1MB cap and automatic truncation
- `src/ports.ts` - Port detection via `lsof` with fallback to log parsing

**Commands** (`src/commands/`): Each command is a citty `defineCommand()` that outputs JSON to stdout and errors to stderr.

**Data storage**: `BGPROC_DATA_DIR` env var overrides default `~/.local/share/bgproc/`. Contains `registry.json` and `logs/` directory.

**Process lifecycle**: Start spawns detached processes with stdout/stderr redirected to log files. Timeout kills are handled by spawning a separate Node process that survives CLI exit.
