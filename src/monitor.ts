import EventEmitter from "events";
const schedule = require('node-schedule');

export class Monitor extends EventEmitter {
    constructor() {
        super();
    }
}