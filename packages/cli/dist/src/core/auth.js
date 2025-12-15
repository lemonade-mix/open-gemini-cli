/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { getErrorMessage, AuthType as AuthTypeEnum, } from "@google/kaidex-cli-core";
/**
 * Handles the initial authentication flow.
 * @param config The application config.
 * @param authType The selected auth type.
 * @returns An error message if authentication fails, otherwise null.
 */
export async function performInitialAuth(config, authType) {
    // Bypass authentication for local LLM usage
    if (process.env["BYPASS_AUTH"] === "true") {
        try {
            await config.refreshAuth(AuthTypeEnum.LOCAL_LLM);
        }
        catch (e) {
            return `Failed to initialize local LLM: ${getErrorMessage(e)}`;
        }
        return null;
    }
    if (!authType) {
        return null;
    }
    try {
        await config.refreshAuth(authType);
        // The console.log is intentionally left out here.
        // We can add a dedicated startup message later if needed.
    }
    catch (e) {
        return `Failed to login. Message: ${getErrorMessage(e)}`;
    }
    return null;
}
//# sourceMappingURL=auth.js.map