# ACME-1: output goes through the logger

Services write what they report through the logger port, so every line carries the request it belongs to and lands where operations reads it. A direct `console` call skips both.

Honours the rule:

```ts
export const traceRequest = (request: { readonly logger: Logger; readonly path: string }): void => {
  request.logger.info({ path: request.path });
};
```

Breaks the rule:

```ts
export const traceRequest = (request: { readonly path: string }): void => {
  console.error(request.path);
};
```
