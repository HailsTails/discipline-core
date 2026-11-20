export type TypeStripping = "strips-types" | "keeps-types";

export type NodeFeatures = Pick<NodeJS.Process["features"], "typescript">;

export type TypeStrippingPort = { readonly state: (request: Record<string, never>) => TypeStripping };

export const typeStrippingOf = (request: { readonly features: NodeFeatures }): TypeStripping =>
  request.features.typescript === false ? "keeps-types" : "strips-types";

export const createDefaultTypeStrippingPort = (_request: Record<string, never>): TypeStrippingPort => ({
  state: (_state) => typeStrippingOf({ features: process.features }),
});
