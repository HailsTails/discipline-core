import piece0 from "../../../CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "honed/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "honed/authorised-location/CD-14#class-syntax/route/[id].ts",
    files: ["route/\\[id\\].ts"],
    rules: { "hone/no-class-authoring": "off" },
  },
];
