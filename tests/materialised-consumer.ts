import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../core/values/absolute-path.ts";
import type { Result } from "../core/values/result.ts";
import { materialisedConsumer } from "../scripts/consumer-fixture.ts";
import { createDefaultScratchFilesPort } from "../scripts/install-proof-ports.ts";

const path = createDefaultPathPort({});

const scratch = createDefaultScratchFilesPort({});

const FIXTURES_FOLDER = path.join({ segments: [import.meta.dirname, "test-fixtures"] });

export const materialisedConsumersFolder = (request: { readonly owner: string }): string =>
  path.join({ segments: [FIXTURES_FOLDER, `materialised-${request.owner}`] });

export const materialisedConsumerFixture = (request: { readonly owner: string; readonly fixture: string }): Result<AbsolutePath, string> => {
  const to = path.resolve({ path: path.join({ segments: [materialisedConsumersFolder(request), request.fixture] }) });
  if (to.outcome === "failed") {
    return { outcome: "failed", error: `${request.fixture} has no absolute materialised path` };
  }
  const cleared = scratch.removeTree({ path: to.value });
  if (cleared.outcome === "failed") {
    return { outcome: "failed", error: cleared.error.detail };
  }
  const materialised = materialisedConsumer({
    scratch,
    fileText: createDefaultFileTextPort({}),
    path,
    from: path.join({ segments: [FIXTURES_FOLDER, "consumer-proof", request.fixture] }),
    to: to.value,
  });
  return materialised.outcome === "failed" ? materialised : { outcome: "ok", value: to.value };
};

export const removedMaterialisedConsumers = (request: { readonly owner: string }): Result<null, string> => {
  const removed = scratch.removeTree({ path: materialisedConsumersFolder(request) });
  return removed.outcome === "failed" ? { outcome: "failed", error: removed.error.detail } : removed;
};
