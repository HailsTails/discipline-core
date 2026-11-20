import { z } from "zod";
import { TOOL_IDENTITY } from "../../../core/values/tool-identity.ts";
import { checkRuleNameOf, type RuledCheck, runsOnEslint } from "./check-rule-id.ts";
import { eslintPieceSettingsSchema } from "./eslint-piece-settings-schema.ts";
import { eslintPluginModuleSchema, type LoadedEslintPlugin } from "./eslint-plugin-schema.ts";

export type PieceSource = { readonly piece: unknown; readonly plugin: unknown };

type PieceRule = LoadedEslintPlugin["rules"][string];

export type ChecksPlugin = {
  readonly meta: { readonly name: string; readonly version: string };
  readonly rules: Readonly<Record<string, PieceRule>>;
};

type ClauseRule = { readonly discipline: string; readonly clause: string; readonly rule: PieceRule };

const PLUGIN_META = { name: `${TOOL_IDENTITY.packageName}/eslint-plugin`, version: "0.0.0-local" };

const NUMBERED_LEAD = /^CD-\d+: /;

const pieceSchema = z.looseObject({
  discipline: z.string(),
  clauses: z.array(z.looseObject({ clause: z.string(), settings: eslintPieceSettingsSchema })),
});

const reportedSchema = z.looseObject({ message: z.string().optional(), data: z.record(z.string(), z.unknown()).optional() });

export const inSymptomWords = (request: { readonly message: string; readonly title: string }): string =>
  `${request.title}: ${request.message.replace(NUMBERED_LEAD, "")}`;

const unnumbered = (request: { readonly data: Readonly<Record<string, unknown>> }): Readonly<Record<string, unknown>> =>
  Object.fromEntries(Object.entries(request.data).map(([key, text]) => [key, typeof text === "string" ? text.replace(NUMBERED_LEAD, "") : text]));

const reworded = (request: { readonly descriptor: unknown; readonly title: string }): unknown => {
  const reported = reportedSchema.safeParse(request.descriptor);
  if (!reported.success) {
    return request.descriptor;
  }
  const { message, data: messageData } = reported.data;
  if (message !== undefined) {
    return { ...reported.data, message: inSymptomWords({ message, title: request.title }) };
  }
  return messageData === undefined ? reported.data : { ...reported.data, data: unnumbered({ data: messageData }) };
};

const contextInSymptomWords = (request: { readonly context: unknown; readonly title: string }): unknown => {
  if (typeof request.context !== "object" || request.context === null) {
    return request.context;
  }
  const report = Reflect.get(request.context, "report");
  if (typeof report !== "function") {
    return request.context;
  }
  return Object.create(request.context, {
    report: { value: (descriptor: unknown) => Reflect.apply(report, request.context, [reworded({ descriptor, title: request.title })]) },
  });
};

const messagesInSymptomWords = (request: { readonly messages: Readonly<Record<string, string>> | undefined; readonly title: string }) =>
  request.messages === undefined
    ? undefined
    : Object.fromEntries(Object.entries(request.messages).map(([messageId, message]) => [messageId, inSymptomWords({ message, title: request.title })]));

const checkRuleOf = (request: { readonly rule: PieceRule; readonly title: string }): PieceRule => ({
  ...request.rule,
  meta: { ...request.rule.meta, messages: messagesInSymptomWords({ messages: request.rule.meta.messages, title: request.title }) },
  create: (context) => request.rule.create(contextInSymptomWords({ context, title: request.title })),
});

const clauseRulesOf = (request: { readonly source: PieceSource }): readonly ClauseRule[] => {
  const piece = pieceSchema.safeParse(request.source.piece);
  const plugin = eslintPluginModuleSchema.safeParse({ default: request.source.plugin });
  if (!piece.success || !plugin.success) {
    return [];
  }
  const rules = plugin.data.default.rules;
  return piece.data.clauses.flatMap((entry) => {
    const rule = Object.hasOwn(rules, entry.settings.rule) ? rules[entry.settings.rule] : undefined;
    return rule === undefined ? [] : [{ discipline: piece.data.discipline, clause: entry.clause, rule }];
  });
};

const pieceRuleOf = (request: { readonly check: RuledCheck; readonly clauseRules: readonly ClauseRule[] }): PieceRule | undefined =>
  request.clauseRules.find(
    (clauseRule) =>
      request.check.clause.ruleSet === TOOL_IDENTITY.ownRuleSet &&
      request.check.clause.discipline === clauseRule.discipline &&
      request.check.clause.clause === clauseRule.clause,
  )?.rule;

export const checksPluginOf = (request: { readonly checks: readonly RuledCheck[]; readonly sources: readonly PieceSource[] }): ChecksPlugin => {
  const clauseRules = request.sources.flatMap((source) => clauseRulesOf({ source }));
  return {
    meta: PLUGIN_META,
    rules: Object.fromEntries(
      request.checks
        .filter((check) => runsOnEslint({ check }) === "eslint")
        .flatMap((check) => {
          const rule = pieceRuleOf({ check, clauseRules });
          return rule === undefined ? [] : [[checkRuleNameOf({ check }), checkRuleOf({ rule, title: check.symptom.title })]];
        }),
    ),
  };
};
