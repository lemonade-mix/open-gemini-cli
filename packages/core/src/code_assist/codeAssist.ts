/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContentGenerator } from "../core/contentGenerator.js";
import { AuthType } from "../core/contentGenerator.js";
import type { HttpOptions } from "./server.js";
import { CodeAssistServer } from "./server.js";
import type { Config } from "../config/config.js";

export async function createCodeAssistContentGenerator(
  _httpOptions: HttpOptions,
  _authType: AuthType,
  config: Config,
  _sessionId?: string,
): Promise<ContentGenerator> {
  // STUB: Never use Google Code Assist - always return local LLM generator
  const { createContentGenerator } = await import(
    "../core/contentGenerator.js"
  );
  return createContentGenerator(config);
}

export function getCodeAssistServer(
  _config: Config,
): CodeAssistServer | undefined {
  // STUB: Never return Google Code Assist server - always undefined
  return undefined;
}
