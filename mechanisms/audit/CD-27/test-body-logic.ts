import type { PieceHit, WalkerPiece } from "../runner/walker-piece.ts";
import { folderScope } from "../runner/source-scope.ts";
import type { CallExpression, PropertyAccessExpression, SyntaxApi, SyntaxNode } from "../runner/typescript-parse.ts";
import { type Edition, editionReaches, editionSchema, FIRST_EDITION } from "../../../core/values/edition.ts";

const testFileEligibility = (request: { readonly file: string }): "eligible" | "skipped" => {
  if (folderScope({ file: request.file }) === "generated") return "skipped";
  return request.file.endsWith(".test.ts") || request.file.endsWith(".test.tsx") ? "eligible" : "skipped";
};

type Remedy = NonNullable<PieceHit["remedy"]>;

export type TestBodyForm = {
  readonly introducedIn: Edition;
  readonly remedy: Remedy;
};

type FormRequest = { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode };

const SECOND_EDITION: Edition = editionSchema.parse("2");

const firstEdition = (remedy: Remedy): TestBodyForm => ({ introducedIn: FIRST_EDITION, remedy });

const secondEdition = (remedy: Remedy): TestBodyForm => ({ introducedIn: SECOND_EDITION, remedy });

const BRANCHING = firstEdition({
  fix: "write one test per case, or one it.each table; to narrow a value that may be missing, assert.isDefined it",
  section: "branching-with-if",
});
const TRY_BLOCK = firstEdition({
  fix: "assert the throw with expect(() => act()).toThrow or await expect(act()).rejects, or assert the failure the unit returns",
  section: "a-try-block",
});
const TERNARY = firstEdition({ fix: "write the value out, or give each case its own it.each row", section: "a-ternary" });
const LET = firstEdition({ fix: "use const; record calls with vi.fn and assert them with toHaveBeenCalledWith", section: "a-let" });
const PICKING_METHOD = firstEdition({
  fix: "assert on the whole array with toEqual, toContain, toContainEqual or expect.arrayContaining",
  section: "a-method-that-picks-or-tests-an-element",
});
const COMPUTING_METHOD = firstEdition({
  fix: "write the expected value out, or match part of it with toMatchObject, toHaveLength or expect.stringContaining",
  section: "a-method-that-computes-a-value",
});
const MUTATING_METHOD = firstEdition({ fix: "write the finished array out as a literal", section: "a-method-that-mutates" });
const SHORT_CIRCUIT = secondEdition({
  fix: "write the value it gives; to narrow a value that may be missing, assert.isDefined it",
  section: "a-short-circuit",
});
const INDEXED_OPTIONAL_CHAIN = secondEdition({
  fix: "compare the whole element with toMatchObject, or destructure it and assert.isDefined it before reading it",
  section: "an-optional-chain-after-an-index",
});
const MOCK_CALL_OPTIONAL_CHAIN = secondEdition({
  fix: "assert the call with toHaveBeenCalledWith or toHaveBeenNthCalledWith",
  section: "an-optional-chain-on-a-mock-call",
});
const PROPERTY_OPTIONAL_CHAIN = secondEdition({
  fix: "compare the whole value with toMatchObject, or destructure it and assert.isDefined it before reading it",
  section: "an-optional-chain-on-a-property",
});
const OPTIONAL_CALL = secondEdition({
  fix: "destructure the function, assert.isDefined it, then call it",
  section: "an-optional-call",
});
const SWITCH = secondEdition({ fix: "write one test per case, or one it.each table", section: "a-switch" });
const JSON_STRINGIFY = secondEdition({ fix: "write the JSON text out as a string literal", section: "serialising-json" });
const JSON_PARSE = secondEdition({
  fix: "compare the raw text, or read it back through the unit's own decoder",
  section: "parsing-json",
});
const OBJECT_ASSIGN = secondEdition({ fix: "write the object out, spreading what it copies", section: "merging-objects" });
const OBJECT_FROM_ENTRIES = secondEdition({ fix: "write the object out as a literal", section: "building-an-object-from-entries" });
const ARRAY_FROM = secondEdition({ fix: "write the array out as a literal", section: "building-an-array-from-a-length" });
const MATH_CALL = secondEdition({ fix: "write the number out", section: "a-math-call" });
const HAND_WRITTEN_DOUBLE: Remedy = {
  fix: "a double with behaviour is a fake: write it once as an in-memory implementation of the port, in its own module with its own tests, as CD-25 says",
  section: "logic-inside-a-hand-written-double",
};

const FORMS_IN_PAGE_ORDER: readonly TestBodyForm[] = [
  BRANCHING,
  TRY_BLOCK,
  TERNARY,
  LET,
  PICKING_METHOD,
  COMPUTING_METHOD,
  MUTATING_METHOD,
  SHORT_CIRCUIT,
  INDEXED_OPTIONAL_CHAIN,
  MOCK_CALL_OPTIONAL_CHAIN,
  PROPERTY_OPTIONAL_CHAIN,
  OPTIONAL_CALL,
  SWITCH,
  JSON_STRINGIFY,
  JSON_PARSE,
  OBJECT_ASSIGN,
  OBJECT_FROM_ENTRIES,
  ARRAY_FROM,
  MATH_CALL,
];

export const TEST_BODY_SECTIONS: readonly string[] = [
  ...FORMS_IN_PAGE_ORDER.map((form) => form.remedy.section),
  "logic-inside-a-hand-written-double",
];

const PICKING_METHODS: readonly string[] = [
  "at", "every", "filter", "find", "findIndex", "findLast", "findLastIndex", "includes", "indexOf", "lastIndexOf", "some",
];
const COMPUTING_METHODS: readonly string[] = [
  "charAt", "charCodeAt", "codePointAt", "concat", "endsWith", "entries", "flat", "flatMap", "forEach", "join", "keys",
  "localeCompare", "map", "match", "matchAll", "normalize", "padEnd", "padStart", "reduce", "reduceRight", "repeat", "replace",
  "replaceAll", "search", "slice", "sort", "split", "startsWith", "substr", "substring", "toLocaleLowerCase",
  "toLocaleUpperCase", "toLowerCase", "toReversed", "toSorted", "toSpliced", "toUpperCase", "trim", "trimEnd", "trimStart",
  "values", "with",
];
const MUTATING_METHODS: readonly string[] = ["copyWithin", "fill", "pop", "push", "reverse", "shift", "splice", "unshift"];

const NAMESPACE_CALLS: ReadonlyMap<string, TestBodyForm> = new Map([
  ["JSON.stringify", JSON_STRINGIFY],
  ["JSON.parse", JSON_PARSE],
  ["Object.assign", OBJECT_ASSIGN],
  ["Object.fromEntries", OBJECT_FROM_ENTRIES],
  ["Array.from", ARRAY_FROM],
]);

const SHORT_CIRCUIT_TOKENS = (request: { readonly syntaxApi: SyntaxApi }): readonly number[] => [
  request.syntaxApi.SyntaxKind.QuestionQuestionToken,
  request.syntaxApi.SyntaxKind.BarBarToken,
  request.syntaxApi.SyntaxKind.AmpersandAmpersandToken,
  request.syntaxApi.SyntaxKind.QuestionQuestionEqualsToken,
  request.syntaxApi.SyntaxKind.BarBarEqualsToken,
  request.syntaxApi.SyntaxKind.AmpersandAmpersandEqualsToken,
];

const MOCK_RECORDS: readonly string[] = ["calls", "results", "instances", "contexts"];

const MOCK_LATEST_RECORDS: readonly string[] = ["lastCall"];

type MockReading = "mock-record" | "other";

const mockPropertyReading = (request: FormRequest & { readonly names: readonly string[] }): MockReading =>
  request.syntaxApi.isPropertyAccessExpression(request.node) &&
  request.names.includes(request.node.name.text) &&
  request.syntaxApi.isPropertyAccessExpression(request.node.expression) &&
  request.node.expression.name.text === "mock"
    ? "mock-record"
    : "other";

const mockRecordReading = (request: FormRequest): MockReading => {
  const { syntaxApi, node } = request;
  if (mockPropertyReading({ syntaxApi, node, names: MOCK_LATEST_RECORDS }) === "mock-record") return "mock-record";
  return syntaxApi.isElementAccessExpression(node)
    ? mockPropertyReading({ syntaxApi, node: node.expression, names: MOCK_RECORDS })
    : "other";
};

const statementForm = (request: FormRequest): TestBodyForm | undefined => {
  const { syntaxApi, node } = request;
  if (syntaxApi.isIfStatement(node)) return BRANCHING;
  if (syntaxApi.isTryStatement(node)) return TRY_BLOCK;
  if (syntaxApi.isSwitchStatement(node)) return SWITCH;
  const isLet = syntaxApi.isVariableStatement(node) &&
    (node.declarationList.flags & syntaxApi.NodeFlags.Let) === syntaxApi.NodeFlags.Let;
  return isLet ? LET : undefined;
};

const methodForm = (request: { readonly name: string }): TestBodyForm | undefined => {
  if (PICKING_METHODS.includes(request.name)) return PICKING_METHOD;
  if (COMPUTING_METHODS.includes(request.name)) return COMPUTING_METHOD;
  return MUTATING_METHODS.includes(request.name) ? MUTATING_METHOD : undefined;
};

const namespaceForm = (request: FormRequest & { readonly name: string }): TestBodyForm | undefined => {
  if (!request.syntaxApi.isIdentifier(request.node)) return undefined;
  if (request.node.text === "Math") return MATH_CALL;
  return NAMESPACE_CALLS.get(`${request.node.text}.${request.name}`);
};

type CallTarget = "own-api" | "built-in-or-library";

type ReceiverRoot = { readonly kind: "name"; readonly name: string } | { readonly kind: "literal" } | { readonly kind: "other" };

const BUILT_IN_NAMESPACES: readonly string[] = [
  "Array", "Atomics", "Buffer", "Date", "Intl", "JSON", "Map", "Math", "Number", "Object", "Promise", "Reflect", "Set", "String",
  "Symbol", "URL", "URLSearchParams", "console", "crypto", "globalThis", "performance", "process",
];

const MOST_ARGUMENTS: ReadonlyMap<string, number> = new Map([
  ...["keys", "values", "entries", "pop", "shift", "reverse", "toReversed", "trim", "trimStart", "trimEnd", "toLowerCase", "toUpperCase"]
    .map((name): [string, number] => [name, 0]),
  ...["join", "at", "charAt", "charCodeAt", "codePointAt", "flat", "sort", "toSorted", "repeat", "normalize", "toLocaleLowerCase",
    "toLocaleUpperCase", "match", "matchAll", "search"].map((name): [string, number] => [name, 1]),
  ...["split", "slice", "substring", "substr", "padStart", "padEnd", "startsWith", "endsWith", "replace", "replaceAll", "map", "filter",
    "find", "findIndex", "findLast", "findLastIndex", "every", "some", "forEach", "flatMap", "reduce", "reduceRight", "with"]
    .map((name): [string, number] => [name, 2]),
  ...["includes", "indexOf", "lastIndexOf", "copyWithin", "localeCompare"].map((name): [string, number] => [name, 3]),
  ["fill", 4],
]);

const OBJECT_POSITIONS: ReadonlyMap<string, { readonly from: number } | { readonly at: readonly number[] }> = new Map<
  string,
  { readonly from: number } | { readonly at: readonly number[] }
>([
  ["includes", { at: [0] }],
  ["indexOf", { at: [0] }],
  ["lastIndexOf", { at: [0] }],
  ["fill", { at: [0] }],
  ["reduce", { at: [1] }],
  ["reduceRight", { at: [1] }],
  ["with", { at: [1] }],
  ["localeCompare", { at: [2] }],
  ["splice", { from: 2 }],
  ["toSpliced", { from: 2 }],
  ["push", { from: 0 }],
  ["unshift", { from: 0 }],
  ["concat", { from: 0 }],
]);

const objectFitsBuiltIn = (request: { readonly name: string; readonly position: number }): "fits" | "never-fits" => {
  const positions = OBJECT_POSITIONS.get(request.name);
  if (positions === undefined) return "never-fits";
  const fits = "from" in positions ? request.position >= positions.from : positions.at.includes(request.position);
  return fits ? "fits" : "never-fits";
};

const receiverRootOf = (request: FormRequest): ReceiverRoot => {
  const { syntaxApi, node } = request;
  if (syntaxApi.isIdentifier(node)) return { kind: "name", name: node.text };
  if (syntaxApi.isStringLiteralLike(node) || syntaxApi.isArrayLiteralExpression(node) || syntaxApi.isTemplateExpression(node)) {
    return { kind: "literal" };
  }
  const isChain = syntaxApi.isPropertyAccessExpression(node) || syntaxApi.isElementAccessExpression(node) ||
    syntaxApi.isCallExpression(node) || syntaxApi.isParenthesizedExpression(node) || syntaxApi.isNonNullExpression(node);
  return isChain ? receiverRootOf({ syntaxApi, node: node.expression }) : { kind: "other" };
};

const packageBindingsOf = (request: FormRequest): readonly string[] =>
  request.node.getSourceFile().statements.flatMap((statement) => {
    const { syntaxApi } = request;
    if (!syntaxApi.isImportDeclaration(statement) || !syntaxApi.isStringLiteral(statement.moduleSpecifier)) return [];
    if (statement.moduleSpecifier.text.startsWith(".") || statement.importClause === undefined) return [];
    const { name, namedBindings } = statement.importClause;
    const named = namedBindings === undefined
      ? []
      : syntaxApi.isNamespaceImport(namedBindings)
        ? [namedBindings.name.text]
        : namedBindings.elements.map((element) => element.name.text);
    return name === undefined ? named : [name.text, ...named];
  });

const receiverTarget = (request: FormRequest): CallTarget => {
  const root = receiverRootOf(request);
  if (root.kind === "literal") return "built-in-or-library";
  if (root.kind === "other") return "own-api";
  return BUILT_IN_NAMESPACES.includes(root.name) || packageBindingsOf(request).includes(root.name) ? "built-in-or-library" : "own-api";
};

const argumentsTarget = (request: { readonly syntaxApi: SyntaxApi; readonly call: CallExpression; readonly name: string }): CallTarget => {
  const { syntaxApi, call, name } = request;
  if (call.arguments.some((argument) => syntaxApi.isSpreadElement(argument))) return "built-in-or-library";
  const mostArguments = MOST_ARGUMENTS.get(name);
  if (mostArguments !== undefined && call.arguments.length > mostArguments) return "own-api";
  const objectNoBuiltInTakes = call.arguments.some((argument, position) =>
    syntaxApi.isObjectLiteralExpression(argument) && objectFitsBuiltIn({ name, position }) === "never-fits");
  return objectNoBuiltInTakes ? "own-api" : "built-in-or-library";
};

const callTargetOf = (request: { readonly syntaxApi: SyntaxApi; readonly call: CallExpression; readonly method: PropertyAccessExpression }): CallTarget => {
  const { syntaxApi, call, method } = request;
  if (receiverTarget({ syntaxApi, node: method.expression }) === "built-in-or-library") return "built-in-or-library";
  return argumentsTarget({ syntaxApi, call, name: method.name.text });
};

const listedMethodForm = (request: { readonly syntaxApi: SyntaxApi; readonly call: CallExpression; readonly method: PropertyAccessExpression }): TestBodyForm | undefined => {
  const form = methodForm({ name: request.method.name.text });
  if (form === undefined) return undefined;
  return callTargetOf(request) === "own-api" ? undefined : form;
};

const callForm = (request: FormRequest): TestBodyForm | undefined => {
  const { syntaxApi, node } = request;
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const calledForm = syntaxApi.isPropertyAccessExpression(node.expression)
    ? listedMethodForm({ syntaxApi, call: node, method: node.expression }) ??
      namespaceForm({ syntaxApi, node: node.expression.expression, name: node.expression.name.text })
    : undefined;
  return calledForm ?? (node.questionDotToken === undefined ? undefined : OPTIONAL_CALL);
};

const optionalChainForm = (request: FormRequest): TestBodyForm | undefined => {
  const { syntaxApi, node } = request;
  const isOptionalAccess = (syntaxApi.isPropertyAccessExpression(node) || syntaxApi.isElementAccessExpression(node)) &&
    node.questionDotToken !== undefined;
  if (!isOptionalAccess) return undefined;
  if (mockRecordReading({ syntaxApi, node: node.expression }) === "mock-record") return MOCK_CALL_OPTIONAL_CHAIN;
  return syntaxApi.isElementAccessExpression(node.expression) ? INDEXED_OPTIONAL_CHAIN : PROPERTY_OPTIONAL_CHAIN;
};

const expressionForm = (request: FormRequest): TestBodyForm | undefined => {
  const { syntaxApi, node } = request;
  if (syntaxApi.isConditionalExpression(node)) return TERNARY;
  if (syntaxApi.isBinaryExpression(node) && SHORT_CIRCUIT_TOKENS({ syntaxApi }).includes(node.operatorToken.kind)) {
    return SHORT_CIRCUIT;
  }
  return callForm(request) ?? optionalChainForm(request);
};

type Enclosure = "hand-written-double" | "elsewhere";

const enclosingFunctionOf = (request: FormRequest): SyntaxNode | undefined => {
  if (request.syntaxApi.isSourceFile(request.node)) return undefined;
  if (request.syntaxApi.isFunctionLike(request.node)) return request.node;
  return enclosingFunctionOf({ syntaxApi: request.syntaxApi, node: request.node.parent });
};

const enclosureOf = (request: FormRequest): Enclosure => {
  const { syntaxApi } = request;
  const enclosing = enclosingFunctionOf({ syntaxApi, node: request.node.parent });
  if (enclosing === undefined) return "elsewhere";
  const holder = syntaxApi.isPropertyAssignment(enclosing.parent) ? enclosing.parent.parent : enclosing.parent;
  return syntaxApi.isObjectLiteralExpression(holder) ? "hand-written-double" : "elsewhere";
};

export const testBodyFormOf = (request: FormRequest): TestBodyForm | undefined => {
  const form = statementForm(request) ?? expressionForm(request);
  if (form === undefined) return undefined;
  return enclosureOf(request) === "hand-written-double" ? { introducedIn: form.introducedIn, remedy: HAND_WRITTEN_DOUBLE } : form;
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
                  const form = testBodyFormOf({ syntaxApi, node });
                  if (form === undefined) return;
                  const reaching = clauses.filter((clause) => editionReaches({ edition: clause.edition, introducedIn: form.introducedIn }) === "reached");
                  if (reaching.length === 0) return;
                  const position = node.getStart(sourceFile);
                  const anchor = anchorAt({ position });
                  const snippet = snippetAt({ source: sourceFile.text, position });
                  hits.push(...reaching.map((clause) => ({ clause: clause.address, anchor, snippet, remedy: form.remedy })));
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
