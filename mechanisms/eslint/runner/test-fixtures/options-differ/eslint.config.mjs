import projection from "./disciplines.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  ...projection,
  { files: ["wide.ts"], rules: { "hone-cd40/max-params": ["error", { max: 3, countVoidThis: true }] } },
];
