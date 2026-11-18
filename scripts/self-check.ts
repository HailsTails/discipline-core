import { createDefaultExceptionRepositoryOf } from "../core/exception-records/exception-layout.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultGitPort } from "../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { createDefaultProcessPort } from "../core/platform-ports/process-port.ts";
import { runSelfCheck } from "./self-check-gate.ts";

await runSelfCheck({
  process: createDefaultProcessPort({}),
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  modules: createDefaultModuleLoaderPort({}),
  git: createDefaultGitPort({}),
  exceptionRepositoryOf: createDefaultExceptionRepositoryOf({}),
  moduleUrl: new URL("../core/check/tool-command.ts", import.meta.url).href,
});