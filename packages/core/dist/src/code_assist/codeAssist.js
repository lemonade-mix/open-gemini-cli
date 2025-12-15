/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { AuthType } from "../core/contentGenerator.js";
import { CodeAssistServer } from "./server.js";
export async function createCodeAssistContentGenerator(_httpOptions, _authType, config, _sessionId) {
    // STUB: Never use Google Code Assist - always return local LLM generator
    const { createContentGenerator } = await import("../core/contentGenerator.js");
    return createContentGenerator(config);
}
export function getCodeAssistServer(_config) {
    // STUB: Never return Google Code Assist server - always undefined
    return undefined;
}
//# sourceMappingURL=codeAssist.js.map