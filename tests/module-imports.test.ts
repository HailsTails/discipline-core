import { describe, expect, it } from "vitest";
import { importsIn, importStatementsIn } from "./module-imports.ts";

const FILE = "source.ts";

describe("importsIn", () => {
  it("reads each static form with the specifier between its quotes and whether it names a value or only a type", () => {
    const text = `import { a } from "./a.ts";
import type { B } from "../b.ts";
import { type C } from "./c.ts";
import "./side-effect.ts";
export { d } from "./d.ts";
export type { E } from "./e.ts";
export * from "./f.ts";
import g = require("./g.ts");
type H = import("./h.ts").H;
`;
    expect(importsIn({ file: FILE, text })).toEqual([
      { specifier: "./a.ts", form: "value" },
      { specifier: "../b.ts", form: "type-only" },
      { specifier: "./c.ts", form: "value" },
      { specifier: "./side-effect.ts", form: "value" },
      { specifier: "./d.ts", form: "value" },
      { specifier: "./e.ts", form: "type-only" },
      { specifier: "./f.ts", form: "value" },
      { specifier: "./g.ts", form: "value" },
      { specifier: "./h.ts", form: "type-only" },
    ]);
  });

  it("reads a dynamic load, or a require, of a quoted string or of a template literal without substitutions as the path it names", () => {
    const text = `const a = await import("./a.ts");
const b = require('../b.ts');
const c = await import(\`./c.ts\`);
const d = require(\`../d.ts\`);
`;
    expect(importsIn({ file: FILE, text })).toEqual([
      { specifier: "./a.ts", form: "dynamic" },
      { specifier: "../b.ts", form: "dynamic" },
      { specifier: "./c.ts", form: "dynamic" },
      { specifier: "../d.ts", form: "dynamic" },
    ]);
  });

  it("reads the path an escape writes, in a string or in a template literal, and passes over a comment in the call", () => {
    const text = `const a = await import("../verd\\x69ct/a.ts");
const b = await import(\`../verd\\x69ct/b.ts\`);
const c = await import(/* note */ "../verdict/c.ts");
const d = await import(
  // note
  "../verdict/d.ts"
);
`;
    expect(importsIn({ file: FILE, text })).toEqual([
      { specifier: "../verdict/a.ts", form: "dynamic" },
      { specifier: "../verdict/b.ts", form: "dynamic" },
      { specifier: "../verdict/c.ts", form: "dynamic" },
      { specifier: "../verdict/d.ts", form: "dynamic" },
    ]);
  });

  it("reads any other argument as computed, by its exact text", () => {
    const text = `const a = await import("../values/" + "x.ts");
const b = await import(\`\${folder}/b.ts\`);
const c = await import(modulePath);
const d = await import(pathToFileURL(request.path).href);
`;
    expect(importsIn({ file: FILE, text })).toEqual([
      { specifier: `"../values/" + "x.ts"`, form: "dynamic" },
      { specifier: `\`\${folder}/b.ts\``, form: "dynamic" },
      { specifier: "modulePath", form: "dynamic" },
      { specifier: "pathToFileURL(request.path).href", form: "dynamic" },
    ]);
  });

  it("reads nothing from a string, a template literal or a comment that only looks like an import", () => {
    const text = `const sample = "import('./a.ts')";
const template = \`import { b } from "./b.ts";\`;
// import("./c.ts")
/* import { d } from "./d.ts"; */
`;
    expect(importsIn({ file: FILE, text })).toEqual([]);
  });

  it("reads a load nested in a function, in source order with the imports around it", () => {
    const text = `import { a } from "./a.ts";
export const load = () => import("./b.ts");
export { c } from "./c.ts";
`;
    expect(importsIn({ file: FILE, text })).toEqual([
      { specifier: "./a.ts", form: "value" },
      { specifier: "./b.ts", form: "dynamic" },
      { specifier: "./c.ts", form: "value" },
    ]);
  });
});

describe("importStatementsIn", () => {
  it("gives each top-level import that names what it takes, and each re-export, as the whole statement with its specifier", () => {
    const text = `import { a } from "./a.ts";
import type {
  B,
  C,
} from "../b.ts";
import "./side-effect.ts";
export { d } from "./d.ts";
export const e = 1;
const loaded = await import("./f.ts");
`;
    expect(importStatementsIn({ file: FILE, text })).toEqual([
      { specifier: "./a.ts", statement: 'import { a } from "./a.ts";' },
      { specifier: "../b.ts", statement: 'import type {\n  B,\n  C,\n} from "../b.ts";' },
      { specifier: "./d.ts", statement: 'export { d } from "./d.ts";' },
    ]);
  });
});
