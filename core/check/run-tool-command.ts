import { parseInvocation } from "./command-arguments.ts";
import { helpText } from "./command-help.ts";
import type { Subcommand } from "./command-line.ts";
import { loadFailureOutcome, versionCommandOutcome } from "./command-outcome.ts";
import { installedVersionOf } from "./installed-version.ts";
import { type CommandRequest, printOutcome, runCheckCommand } from "./run-check-command.ts";
import { runProjectCommand } from "./run-project-command.ts";

export type CommandHandler = (request: CommandRequest) => Promise<void>;

type Subcommands = Readonly<Record<Subcommand, CommandHandler>>;

const thrownMessage = (request: { readonly thrown: unknown }): string =>
  request.thrown instanceof Error ? request.thrown.message : String(request.thrown);

const dispatched = (request: { readonly subcommands: Subcommands; readonly command: CommandRequest }): Promise<void> => {
  const { command } = request;
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
      printOutcome({ process: command.process, outcome: versionCommandOutcome({ result: installedVersionOf(command) }) });
      return Promise.resolve();
    case "run":
      return request.subcommands[invocation.value.subcommand]({
        ...command,
        process: { ...command.process, arguments: invocation.value.arguments },
      });
  }
};

export const toolCommandOf =
  (request: { readonly subcommands: Subcommands }): CommandHandler =>
  (command) =>
    Promise.resolve()
      .then(() => dispatched({ subcommands: request.subcommands, command }))
      .catch((thrown: unknown) => {
        printOutcome({
          process: command.process,
          outcome: loadFailureOutcome({ failure: { kind: "unexpected-error", detail: thrownMessage({ thrown }) } }),
        });
      });

export const runToolCommand: CommandHandler = toolCommandOf({
  subcommands: { check: runCheckCommand, project: runProjectCommand },
});
