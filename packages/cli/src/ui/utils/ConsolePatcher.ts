/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import util from "node:util";
import fs from "node:fs";
import type { ConsoleMessageItem } from "../types.js";

interface ConsolePatcherParams {
  onNewMessage?: (message: Omit<ConsoleMessageItem, "id">) => void;
  debugMode: boolean;
  stderr?: boolean;
}

export class ConsolePatcher {
  private originalConsoleLog = console.log;
  private originalConsoleWarn = console.warn;
  private originalConsoleError = console.error;
  private originalConsoleDebug = console.debug;
  private originalConsoleInfo = console.info;

  private params: ConsolePatcherParams;

  constructor(params: ConsolePatcherParams) {
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

  private formatArgs = (args: unknown[]): string => util.format(...args);

  private logToFile(type: string, message: string) {
    if (type !== "error") return; // limit noise: only persist errors
    try {
      const ts = new Date().toISOString();
      const logPath = `/tmp/kaidex_errors_${ts.slice(0, 10)}.log`;
      const line = `[${ts}] ui:${type} ${message}\n`;
      fs.appendFileSync(logPath, line);
    } catch (error) {
      if (this.params.debugMode) {
        this.originalConsoleError("Failed to write log:", error);
      }
    }
  }

  private patchConsoleMethod =
    (
      type: "log" | "warn" | "error" | "debug" | "info",
      originalMethod: (...args: unknown[]) => void,
    ) =>
    (...args: unknown[]) => {
      const formatted = this.formatArgs(args);
      if (this.params.stderr) {
        if (type !== "debug" || this.params.debugMode) {
          this.originalConsoleError(formatted);
        }
      } else {
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
