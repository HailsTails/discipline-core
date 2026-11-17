import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultGitHistoryPort } from "../core/platform-ports/git-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { createDefaultProcessPort } from "../core/platform-ports/process-port.ts";
import { runReleasePullRequest } from "./release-pull-request.ts";

runReleasePullRequest({
  process: createDefaultProcessPort({}),
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  history: createDefaultGitHistoryPort({}),
  moduleUrl: import.meta.url,
});
