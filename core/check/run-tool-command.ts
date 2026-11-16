import { parseSubcommand, type Subcommand } from "./command-arguments-schema.ts";
import { loadFailureOutcome } from "./command-outcome.ts";
import { type CommandRequest, printOutcome, runCheckCommand } from "./run-check-command.ts";
import { runProjectCommand } from "./run-project-command.ts";

export type CommandHandler = (request: CommandRequest) => Promise<void>;

export const toolCommandOf =
  (request: { readonly subcommands: Readonly<Record<Subcommand, CommandHandler>> }): CommandHandler =>
  (command) => {
    const invocation = parseSubcommand({ arguments: command.process.arguments });
    if (invocation.outcome === "failed") {
      printOutcome({ process: command.process, outcome: loadFailureOutcome({ failure: invocation.error }) });
      return Promise.resolve();
    }
    return request.subcommands[invocation.value.subcommand]({
      ...command,
      process: { ...command.process, arguments: invocation.value.arguments },
    });
  };

export const runToolCommand: CommandHandler = toolCommandOf({
  subcommands: { check: runCheckCommand, project: runProjectCommand },
});
