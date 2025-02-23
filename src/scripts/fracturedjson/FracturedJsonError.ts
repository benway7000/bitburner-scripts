﻿import {InputPosition} from "scripts/fracturedjson/InputPosition";

export class FracturedJsonError extends Error {
    InputPosition?: InputPosition;
    constructor(message?: string, pos?: InputPosition) {
        const msgWithPos = (pos)? `${message} at idx=${pos.Index}, row=${pos.Row}, col=${pos.Column}`
            : message;
        super(msgWithPos);
        this.InputPosition = pos;
    }
}
