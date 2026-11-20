export const systemErrorOf = (request: { readonly code: string; readonly message: string }): Error =>
  Object.assign(new Error(request.message), { code: request.code });
