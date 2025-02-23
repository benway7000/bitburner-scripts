
export type Falsey = null | undefined | false | "" | 0 | 0n;
export type Truthy<T> = T extends Falsey ? never : T;


/**
 * Returns the input array as a comma separated string.
 *
 * Does several things that Array.toString() doesn't do
 *  - Adds brackets around the array
 *  - Adds quotation marks around strings
 */
export function arrayToString(a: unknown[]): string {
  const vals: unknown[] = [];
  for (let i = 0; i < a.length; ++i) {
    let elem: unknown = a[i];
    if (Array.isArray(elem)) {
      elem = arrayToString(elem);
    } else if (typeof elem === "string") {
      elem = `"${elem}"`;
    }
    vals.push(elem);
  }

  return `[${vals.join(", ")}]`;
}

export function filterTruthy<T>(input: T[]): Truthy<T>[] {
  return input.filter(Boolean) as Truthy<T>[];
}