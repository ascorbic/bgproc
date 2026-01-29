# bgproc

## 0.2.1

### Patch Changes

- [#5](https://github.com/ascorbic/bgproc/pull/5) [`5219248`](https://github.com/ascorbic/bgproc/commit/5219248518119496421bcebc8710dfee0d9a2576) Thanks [@ascorbic](https://github.com/ascorbic)! - Sort detected ports numerically so the `port` field returns the lowest port number

## 0.2.0

### Minor Changes

- [#3](https://github.com/ascorbic/bgproc/pull/3) [`eb9ffa5`](https://github.com/ascorbic/bgproc/commit/eb9ffa519d765b1781a921e88a53b005ba4740f4) Thanks [@ascorbic](https://github.com/ascorbic)! - Add `--force` / `-f` flag to `start` command that kills any existing process with the same name before starting.

- [#3](https://github.com/ascorbic/bgproc/pull/3) [`eb9ffa5`](https://github.com/ascorbic/bgproc/commit/eb9ffa519d765b1781a921e88a53b005ba4740f4) Thanks [@ascorbic](https://github.com/ascorbic)! - Add `--wait-for-port` flag to `start` command that waits for port detection before exiting. Optionally accepts a timeout in seconds. By default, kills the process on timeout; use `--keep` to leave it running.

### Patch Changes

- [#3](https://github.com/ascorbic/bgproc/pull/3) [`eb9ffa5`](https://github.com/ascorbic/bgproc/commit/eb9ffa519d765b1781a921e88a53b005ba4740f4) Thanks [@ascorbic](https://github.com/ascorbic)! - Make `list` output consistent with `status` by adding `ports`, `uptime`, and `killAt` fields.

- [#3](https://github.com/ascorbic/bgproc/pull/3) [`eb9ffa5`](https://github.com/ascorbic/bgproc/commit/eb9ffa519d765b1781a921e88a53b005ba4740f4) Thanks [@ascorbic](https://github.com/ascorbic)! - Fix port detection to check descendant processes, not just the main PID. This fixes detection for dev servers that spawn child processes to listen on ports.

## 0.1.0

### Minor Changes

- [`a9d9b99`](https://github.com/ascorbic/bgproc/commit/a9d9b99468325c6770ac799a776699cd8764643b) Thanks [@ascorbic](https://github.com/ascorbic)! - Initial release
