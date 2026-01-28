import { defineCommand, runMain } from "citty";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { logsCommand } from "./commands/logs.js";
import { stopCommand } from "./commands/stop.js";
import { listCommand } from "./commands/list.js";
import { cleanCommand } from "./commands/clean.js";

const main = defineCommand({
  meta: {
    name: "bgproc",
    version: "0.1.0",
    description: "Simple process manager for agents. All commands output JSON to stdout.\nExample: bgproc start -n myserver -- npm run dev",
  },
  subCommands: {
    start: startCommand,
    status: statusCommand,
    logs: logsCommand,
    stop: stopCommand,
    list: listCommand,
    clean: cleanCommand,
  },
});

await runMain(main);
