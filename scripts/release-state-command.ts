import { createDefaultProcessPort } from "../core/platform-ports/process-port.ts";
import { runReleaseState } from "./release-state.ts";

runReleaseState({ process: createDefaultProcessPort({}) });
