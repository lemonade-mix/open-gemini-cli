/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
export interface LLMProviderConfig {
    name: string;
    baseURL: string;
    endpoint: string;
    headers: Record<string, string>;
    format: "openai" | "claude";
    streaming: boolean;
    defaultModel?: string;
    maxInputTokens?: number;
    maxOutputTokens?: number;
}
/**
 * Load LLM provider configuration
 * @param providerName - Name of the provider (e.g., "openai", "claude", "local-mlx")
 * @returns Provider configuration with environment variables substituted
 */
export declare function loadProviderConfig(providerName?: string): LLMProviderConfig;
/**
 * List all available providers
 */
export declare function listProviders(): string[];
