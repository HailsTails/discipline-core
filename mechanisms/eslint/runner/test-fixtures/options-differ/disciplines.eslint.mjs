import piece0 from "../../../CD-40/cd40/cd40.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone-cd40",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone-cd40": piece0 },
    rules: { "hone-cd40/max-params": ["error",{"max":2,"countVoidThis":true}] },
  },
];
