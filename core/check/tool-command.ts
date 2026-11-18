#!/usr/bin/env node
import { createDefaultExceptionRepositoryOf } from "../exception-records/exception-layout.ts";
import { createDefaultFileTextPort } from "../platform-ports/file-text-port.ts";
import { createDefaultGitPort } from "../platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../platform-ports/path-port.ts";
import { createDefaultProcessPort } from "../platform-ports/process-port.ts";
import { runToolCommand } from "./run-tool-command.ts";

await runToolCommand({
  process: createDefaultProcessPort({}),
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  modules: createDefaultModuleLoaderPort({}),
  git: createDefaultGitPort({}),
  exceptionRepositoryOf: createDefaultExceptionRepositoryOf({}),
  moduleUrl: import.meta.url,
});
