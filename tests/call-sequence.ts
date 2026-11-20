export type RecordedMock = {
  readonly mock: { readonly calls: readonly (readonly unknown[])[]; readonly invocationCallOrder: readonly number[] };
};

export type RecordedCall = { readonly port: string; readonly arguments: readonly unknown[] };

type OrderedCall = RecordedCall & { readonly order: number };

const orderedCallsOf = (request: { readonly port: string; readonly mock: RecordedMock }): readonly OrderedCall[] =>
  request.mock.mock.calls.map((callArguments, index) => ({ port: request.port, arguments: callArguments, order: request.mock.mock.invocationCallOrder[index] }));

export const callSequenceOf = (request: { readonly mocks: Readonly<Record<string, RecordedMock>> }): readonly RecordedCall[] =>
  Object.entries(request.mocks)
    .flatMap(([port, mock]) => orderedCallsOf({ port, mock }))
    .toSorted((left, right) => left.order - right.order)
    .map(({ port, arguments: callArguments }) => ({ port, arguments: callArguments }));
