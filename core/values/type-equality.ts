export type Equal<A, B> =
  (<Probe>() => Probe extends A ? 1 : 2) extends <Probe>() => Probe extends B
    ? 1
    : 2
    ? true
    : false;

type Writable<Value> = Value extends string | number | boolean | bigint | symbol | null | undefined
  ? Value
  : { -readonly [Key in keyof Value]: Writable<Value[Key]> };

export type EqualIgnoringReadonly<A, B> = Equal<Writable<A>, Writable<B>>;
