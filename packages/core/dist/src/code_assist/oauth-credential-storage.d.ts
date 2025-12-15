/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Credentials } from "google-auth-library";
import { HybridTokenStorage } from "../mcp/token-storage/hybrid-token-storage.js";
export declare class OAuthCredentialStorage {
    private readonly storage;
    constructor(storage?: HybridTokenStorage);
    /**
     * Load cached OAuth credentials
     */
    loadCredentials(): Promise<Credentials | null>;
    /**
     * Save OAuth credentials
     */
    saveCredentials(credentials: Credentials): Promise<void>;
    /**
     * Clear cached OAuth credentials
     */
    clearCredentials(): Promise<void>;
    /**
     * Migrate credentials from old file-based storage to keychain
     */
    private migrateFromFileStorage;
}
