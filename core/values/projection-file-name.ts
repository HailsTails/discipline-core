export const projectionFileNameOf = (request: { readonly engineName: string }): string => `hone.${request.engineName}.mjs`;
