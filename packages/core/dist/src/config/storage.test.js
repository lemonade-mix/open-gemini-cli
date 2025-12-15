/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, vi } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
vi.mock("fs", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        mkdirSync: vi.fn(),
    };
});
import { Storage } from "./storage.js";
describe("Storage – getGlobalSettingsPath", () => {
    it("returns path to ~/.kaidex/settings.json", () => {
        const expected = path.join(os.homedir(), ".kaidex", "settings.json");
        expect(Storage.getGlobalSettingsPath()).toBe(expected);
    });
});
describe("Storage – additional helpers", () => {
    const projectRoot = "/tmp/project";
    const storage = new Storage(projectRoot);
    it("getWorkspaceSettingsPath returns project/.kaidex/settings.json", () => {
        const expected = path.join(projectRoot, ".kaidex", "settings.json");
        expect(storage.getWorkspaceSettingsPath()).toBe(expected);
    });
    it("getUserCommandsDir returns ~/.kaidex/commands", () => {
        const expected = path.join(os.homedir(), ".kaidex", "commands");
        expect(Storage.getUserCommandsDir()).toBe(expected);
    });
    it("getProjectCommandsDir returns project/.kaidex/commands", () => {
        const expected = path.join(projectRoot, ".kaidex", "commands");
        expect(storage.getProjectCommandsDir()).toBe(expected);
    });
    it("getMcpOAuthTokensPath returns ~/.kaidex/mcp-oauth-tokens.json", () => {
        const expected = path.join(os.homedir(), ".kaidex", "mcp-oauth-tokens.json");
        expect(Storage.getMcpOAuthTokensPath()).toBe(expected);
    });
    it("getGlobalBinDir returns ~/.kaidex/tmp/bin", () => {
        const expected = path.join(os.homedir(), ".kaidex", "tmp", "bin");
        expect(Storage.getGlobalBinDir()).toBe(expected);
    });
});
//# sourceMappingURL=storage.test.js.map