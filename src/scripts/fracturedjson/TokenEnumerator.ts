import {JsonToken} from "scripts/fracturedjson/JsonToken";
import {FracturedJsonError} from "scripts/fracturedjson/FracturedJsonError";

/**
 * Provided .NET-like Enumerator semantics wrapped around a TypeScript Generator.
 */
export class TokenEnumerator {
    public get Current():JsonToken {
        if (!this._current)
            throw new FracturedJsonError("Illegal enumerator usage");
        return this._current;
    }

    constructor(generator: Generator<JsonToken>) {
        this._generator = generator;
    }

    MoveNext(): boolean {
        const genItem = this._generator.next();
        this._current = genItem.value;
        return !genItem.done;
    }

    private _generator:Generator<JsonToken>;
    private _current?: JsonToken;
}
