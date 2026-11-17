import { createDefaultProcessPort } from "../core/platform-ports/process-port.ts";
import { runReleaseTag } from "./release-tag.ts";

runReleaseTag({ process: createDefaultProcessPort({}) });
