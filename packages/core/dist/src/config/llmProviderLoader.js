/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Substitute environment variables in a string
 * Example: "${OPENAI_API_KEY}" -> "sk-..."
 */
function substituteEnvVars(value) {
    return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
        const envValue = process.env[varName];
        if (!envValue) {
            console.warn(`Warning: Environment variable ${varName} not set, using empty string`);
            return "";
        }
        return envValue;
    });
}
/**
 * Recursively substitute environment variables in an object
 */
function substituteEnvVarsInObject(obj) {
    if (typeof obj === "string") {
        return substituteEnvVars(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map((item) => substituteEnvVarsInObject(item));
    }
    if (obj !== null && typeof obj === "object") {
        const result = {};
        for (const key in obj) {
            result[key] = substituteEnvVarsInObject(obj[key]);
        }
        return result;
    }
    return obj;
}
/**
 * Load LLM provider configuration
 * @param providerName - Name of the provider (e.g., "openai", "claude", "local-mlx")
 * @returns Provider configuration with environment variables substituted
 */
export function loadProviderConfig(providerName) {
    // Default to local-mlx if not specified
    const provider = providerName || process.env["LLM_PROVIDER"] || "local-mlx";
    // Load providers.json
    const configPath = path.join(__dirname, "llmProviders.json");
    const configData = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(configData);
    // Get provider config
    const providerConfig = config.providers[provider];
    if (!providerConfig) {
        throw new Error(`Unknown LLM provider: ${provider}. Available providers: ${Object.keys(config.providers).join(", ")}`);
    }
    // Substitute environment variables
    const substitutedConfig = substituteEnvVarsInObject(providerConfig);
    // Validate required fields
    if (!substitutedConfig.baseURL) {
        throw new Error(`Provider ${provider} has empty baseURL. Check environment variables.`);
    }
    console.log(`📡 Using LLM provider: ${substitutedConfig.name} (${provider})`);
    console.log(`📡 Endpoint: ${substitutedConfig.baseURL}${substitutedConfig.endpoint}`);
    return substitutedConfig;
}
/**
 * List all available providers
 */
export function listProviders() {
    const configPath = path.join(__dirname, "llmProviders.json");
    const configData = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(configData);
    return Object.keys(config.providers);
}
//# sourceMappingURL=llmProviderLoader.js.map