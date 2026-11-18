import type { PieceHit, WalkerPiece } from "../runner/walker-piece.ts";
import { folderScope } from "../runner/source-scope.ts";
import type { SyntaxApi, SyntaxNode } from "../runner/typescript-parse.ts";
import { type Edition, editionReaches, editionSchema, FIRST_EDITION } from "../../../core/values/edition.ts";

const testFileEligibility = (request: { readonly file: string }): "eligible" | "skipped" => {
  if (folderScope({ file: request.file }) === "generated") return "skipped";
  return request.file.endsWith(".test.ts") || request.file.endsWith(".test.tsx") ? "eligible" : "skipped";
};

const SECOND_EDITION: Edition = editionSchema.parse("2");

const BANNED_DYNAMIC_METHODS: readonly string[] = [
  "at", "charAt", "charCodeAt", "codePointAt", "concat", "endsWith", "entries", "every", "filter", "find",
  "findIndex", "findLast", "findLastIndex", "flat", "flatMap", "forEach", "includes", "indexOf", "join",
  "keys", "lastIndexOf", "localeCompare", "map", "match", "matchAll", "normalize", "padEnd", "padStart",
  "reduce", "reduceRight", "repeat", "replace", "replaceAll", "search", "slice", "some", "sort", "split",
  "startsWith", "substr", "substring", "toLocaleLowerCase", "toLocaleUpperCase", "toLowerCase", "toReversed",
  "toSorted", "toSpliced", "toUpperCase", "trim", "trimEnd", "trimStart", "values", "with",
];
const BANNED_MUTATION_METHODS: readonly string[] = ["copyWithin", "fill", "pop", "push", "reverse", "shift", "splice", "unshift"];

const EVERY_METHOD = "every-method";

const COMPUTING_NAMESPACES: ReadonlyMap<string, readonly string[] | typeof EVERY_METHOD> = new Map<string, readonly string[] | typeof EVERY_METHOD>([
  ["JSON", ["stringify", "parse"]],
  ["Object", ["assign", "fromEntries"]],
  ["Array", ["from"]],
  ["Math", EVERY_METHOD],
]);

type LogicPresence = "logic" | "plain";

const firstEditionLogic = (request: { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode }): LogicPresence => {
  const { syntaxApi, node } = request;
  const isStructural = syntaxApi.isIfStatement(node) || syntaxApi.isTryStatement(node) ||
    syntaxApi.isConditionalExpression(node) ||
    (syntaxApi.isVariableStatement(node) &&
      (node.declarationList.flags & syntaxApi.NodeFlags.Let) === syntaxApi.NodeFlags.Let);
  const methodName = syntaxApi.isCallExpression(node) && syntaxApi.isPropertyAccessExpression(node.expression)
    ? node.expression.name.text
    : undefined;
  return isStructural || (methodName !== undefined &&
    (BANNED_DYNAMIC_METHODS.includes(methodName) || BANNED_MUTATION_METHODS.includes(methodName)))
    ? "logic"
    : "plain";
};

const shortCircuitOperators = (request: { readonly syntaxApi: SyntaxApi }): readonly number[] => [
  request.syntaxApi.SyntaxKind.QuestionQuestionToken,
  request.syntaxApi.SyntaxKind.BarBarToken,
  request.syntaxApi.SyntaxKind.AmpersandAmpersandToken,
  request.syntaxApi.SyntaxKind.QuestionQuestionEqualsToken,
  request.syntaxApi.SyntaxKind.BarBarEqualsToken,
  request.syntaxApi.SyntaxKind.AmpersandAmpersandEqualsToken,
];

const namespaceComputation = (request: { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode }): LogicPresence => {
  const { syntaxApi, node } = request;
  if (!syntaxApi.isCallExpression(node) || !syntaxApi.isPropertyAccessExpression(node.expression)) return "plain";
  const receiver = node.expression.expression;
  if (!syntaxApi.isIdentifier(receiver)) return "plain";
  const methods = COMPUTING_NAMESPACES.get(receiver.text);
  if (methods === undefined) return "plain";
  return methods === EVERY_METHOD || methods.includes(node.expression.name.text) ? "logic" : "plain";
};

const secondEditionLogic = (request: { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode }): LogicPresence => {
  const { syntaxApi, node } = request;
  const isShortCircuit = syntaxApi.isBinaryExpression(node) &&
    shortCircuitOperators({ syntaxApi }).includes(node.operatorToken.kind);
  const isOptionalChain = (syntaxApi.isPropertyAccessExpression(node) || syntaxApi.isElementAccessExpression(node) ||
    syntaxApi.isCallExpression(node)) && node.questionDotToken !== undefined;
  return isShortCircuit || isOptionalChain || syntaxApi.isSwitchStatement(node) || namespaceComputation(request) === "logic"
    ? "logic"
    : "plain";
};

const editionIntroducing = (request: { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode }): Edition | undefined => {
  if (firstEditionLogic(request) === "logic") return FIRST_EDITION;
  if (secondEditionLogic(request) === "logic") return SECOND_EDITION;
  return undefined;
};

const snippetAt = (request: { readonly source: string; readonly position: number }): string => {
  const snippet = request.source.slice(request.position, request.position + 80).replace(/\n/g, " ");
  return snippet.length === 80 ? `${snippet}…` : snippet;
};

export const check: WalkerPiece = {
  prepare: ({ clauses, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (testFileEligibility({ file }) === "skipped") {
          return { outcome: "ok", value: { kind: "skipped" } };
        }
        return {
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ sourceFile, anchorAt }) => {
              const hits: PieceHit[] = [];
              return {
                enter: ({ node }) => {
                  const introducedIn = editionIntroducing({ syntaxApi, node });
                  if (introducedIn === undefined) return;
                  const reaching = clauses.filter((clause) => editionReaches({ edition: clause.edition, introducedIn }) === "reached");
                  if (reaching.length === 0) return;
                  const position = node.getStart(sourceFile);
                  const anchor = anchorAt({ position });
                  const snippet = snippetAt({ source: sourceFile.text, position });
                  hits.push(...reaching.map((clause) => ({ clause: clause.address, anchor, snippet })));
                },
                finish: () => hits,
              };
            },
          },
        };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
