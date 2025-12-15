/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {} from "@google/kaidex-cli-core";
import {} from "../config/settings.js";
import { performInitialAuth } from "./auth.js";
import { validateTheme } from "./theme.js";
/**
 * Orchestrates the application's startup initialization.
 * This runs BEFORE the React UI is rendered.
 * @param config The application config.
 * @param settings The loaded application settings.
 * @returns The results of the initialization.
 */
export async function initializeApp(config, settings) {
    const authError = await performInitialAuth(config, settings.merged.security?.auth?.selectedType);
    const themeError = validateTheme(settings);
    const shouldOpenAuthDialog = settings.merged.security?.auth?.selectedType === undefined || !!authError;
    return {
        authError,
        themeError,
        shouldOpenAuthDialog,
        kaidexMdFileCount: config.getKaiDexMdFileCount(),
    };
}
//# sourceMappingURL=initializer.js.map