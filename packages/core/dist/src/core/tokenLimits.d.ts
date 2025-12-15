/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
type Model = string;
type TokenCount = number;
export declare const QWEN3_CODER_30B = 256000;
export declare const GOOGLE_GEMINI_2_5 = 1048576;
export declare const GOOGLE_GEMINI_1_5_PRO = 2097152;
export declare const DEFAULT_TOKEN_LIMIT = 256000;
export declare function tokenLimit(model: Model): TokenCount;
export {};
