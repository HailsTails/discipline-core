const CHECK_MARK = "#";

export const symptomNameOf = (request: { readonly address: string }): string => request.address.split(CHECK_MARK)[0] ?? request.address;
