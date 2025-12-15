/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
// Token limit constants for different model types
export const QWEN3_CODER_30B = 256_000; // Qwen3-Coder-30B context limit
export const GOOGLE_GEMINI_2_5 = 1_048_576; // Standard Gemini 2.5 models
export const GOOGLE_GEMINI_1_5_PRO = 2_097_152; // Gemini 1.5 Pro
// Default for local LLMs and unknown models
export const DEFAULT_TOKEN_LIMIT = QWEN3_CODER_30B;
// export const DEFAULT_TOKEN_LIMIT = GOOGLE_GEMINI_2_5;  // Uncomment for Gemini default
export function tokenLimit(model) {
    // Add other models as they become relevant or if specified by config
    // Pulled from https://ai.google.dev/gemini-api/docs/models
    switch (model) {
        case "gemini-1.5-pro":
            return GOOGLE_GEMINI_1_5_PRO;
        case "gemini-1.5-flash":
        case "gemini-2.5-pro-preview-05-06":
        case "gemini-2.5-pro-preview-06-05":
        case "gemini-2.5-pro":
        case "gemini-2.5-flash-preview-05-20":
        case "gemini-2.5-flash":
        case "gemini-2.5-flash-lite":
        case "gemini-2.0-flash":
            return GOOGLE_GEMINI_2_5;
        case "gemini-2.0-flash-preview-image-generation":
            return 32_000;
        // Local LLM models
        case "kaidex-server":
        case "qwen32b":
        case "gemma3-27b":
        case "magistral24b":
            return QWEN3_CODER_30B;
        default:
            return DEFAULT_TOKEN_LIMIT;
    }
}
//# sourceMappingURL=tokenLimits.js.map