import { createDefaultProcessPort, defaultErrorWriter } from "../core/platform-ports/process-port.ts";
import { TOOL_IDENTITY } from "../core/values/tool-identity.ts";
import { runReleaseText } from "./release-text.ts";

runReleaseText({ process: { ...createDefaultProcessPort({}), writeError: defaultErrorWriter }, identity: TOOL_IDENTITY });
