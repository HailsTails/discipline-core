import { parseInvocation } from "./command-arguments.ts";
import { helpText } from "./command-help.ts";
import type { Subcommand } from "./command-line.ts";
import { type CommandOutcome, loadFailureOutcome } from "./command-outcome.ts";
import { installedVersionOf } from "./installed-version.ts";
import { type CommandRequest, printOutcome, runCheckCommand } from "./run-check-command.ts";
import { runProjectCommand } from "./run-project-command.ts";

export type CommandHandler = (request: CommandRequest) => Promise<void>;

const versionOutcome = (request: CommandRequest): CommandOutcome => {
  const version = installedVersionOf(request);
  return version.outcome === "failed" ? loadFailureOutcome({ failure: version.error }) : { code: 0, text: `${version.value}\n` };
};

export const toolCommandOf =
  (request: { readonly subcommands: Readonly<Record<Subcommand, CommandHandler>> }): CommandHandler =>
  (command) => {
    const invocation = parseInvocation({ arguments: command.process.arguments });
    if (invocation.outcome === "failed") {
      printOutcome({ process: command.process, outcome: loadFailureOutcome({ failure: invocation.error }) });
      return Promise.resolve();
    }
    switch (invocation.value.kind) {
      case "help":
        printOutcome({ process: command.process, outcome: { code: 0, text: helpText(invocation.value) } });
        return Promise.resolve();
      case "version":
        printOutcome({ process: command.process, outcome: versionOutcome(command) });
        return Promise.resolve();
      case "run":
        return request.subcommands[invocation.value.subcommand]({
          ...command,
          process: { ...command.process, arguments: invocation.value.arguments },
        });
    }
  };

export const runToolCommand: CommandHandler = toolCommandOf({
  subcommands: { check: runCheckCommand, project: runProjectCommand },
});
