import piece0 from "../../../CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "hone-core/authorised-location/CD-14#class-syntax/src/owned.ts",
    files: ["src/owned.ts"],
    rules: { "hone/no-class-authoring": "off" },
  },
];
