import projection from "./disciplines.eslint.mts";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  ...projection,
];
