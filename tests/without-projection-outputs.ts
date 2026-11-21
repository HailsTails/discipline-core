import { projectionOutputNamesOf } from "../core/values/projection-outputs.ts";

const PROJECTED_ENGINE_NAMES: readonly string[] = ["eslint"];

const PROJECTION_OUTPUT_NAMES: readonly string[] = projectionOutputNamesOf({ engineNames: PROJECTED_ENGINE_NAMES });

const PATH_SEPARATOR = "/";

const fileNameOf = (request: { readonly file: string }): string => request.file.slice(request.file.lastIndexOf(PATH_SEPARATOR) + PATH_SEPARATOR.length);

export const withoutProjectionOutputs = (request: { readonly sources: Readonly<Record<string, string>> }): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(request.sources).filter(([file]) => !PROJECTION_OUTPUT_NAMES.includes(fileNameOf({ file }))));
