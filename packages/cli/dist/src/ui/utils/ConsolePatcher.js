/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import util from "node:util";
import fs from "node:fs";
export class ConsolePatcher {
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    originalConsoleDebug = console.debug;
    originalConsoleInfo = console.info;
    params;
    constructor(params) {
        this.params = params;
    }
    patch() {
        console.log = this.patchConsoleMethod("log", this.originalConsoleLog);
        console.warn = this.patchConsoleMethod("warn", this.originalConsoleWarn);
        console.error = this.patchConsoleMethod("error", this.originalConsoleError);
        console.debug = this.patchConsoleMethod("debug", this.originalConsoleDebug);
        console.info = this.patchConsoleMethod("info", this.originalConsoleInfo);
    }
    cleanup = () => {
        console.log = this.originalConsoleLog;
        console.warn = this.originalConsoleWarn;
        console.error = this.originalConsoleError;
        console.debug = this.originalConsoleDebug;
        console.info = this.originalConsoleInfo;
    };
    formatArgs = (args) => util.format(...args);
    logToFile(type, message) {
        if (type !== "error")
            return; // limit noise: only persist errors
        try {
            const ts = new Date().toISOString();
            const logPath = `/tmp/kaidex_errors_${ts.slice(0, 10)}.log`;
            const line = `[${ts}] ui:${type} ${message}\n`;
            fs.appendFileSync(logPath, line);
        }
        catch (error) {
            if (this.params.debugMode) {
                this.originalConsoleError("Failed to write log:", error);
            }
        }
    }
    patchConsoleMethod = (type, originalMethod) => (...args) => {
        const formatted = this.formatArgs(args);
        if (this.params.stderr) {
            if (type !== "debug" || this.params.debugMode) {
                this.originalConsoleError(formatted);
            }
        }
        else {
            if (this.params.debugMode) {
                originalMethod.apply(console, args);
            }
            if (type !== "debug" || this.params.debugMode) {
                this.params.onNewMessage?.({
                    type,
                    content: formatted,
                    count: 1,
                });
                this.logToFile(type, formatted);
            }
        }
    };
}
//# sourceMappingURL=ConsolePatcher.js.map