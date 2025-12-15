/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_KAIDEX_FLASH_MODEL } from "../config/models.js";
import { KaiDexClient } from "../core/client.js";
import { checkNextSpeaker } from "./nextSpeakerChecker.js";
import { KaiDexChat } from "../core/kaidexChat.js";
// Mock fs module to prevent actual file system operations during tests
const mockFileSystem = new Map();
vi.mock("node:fs", () => {
    const fsModule = {
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn((path, data) => {
            mockFileSystem.set(path, data);
        }),
        readFileSync: vi.fn((path) => {
            if (mockFileSystem.has(path)) {
                return mockFileSystem.get(path);
            }
            throw Object.assign(new Error("ENOENT: no such file or directory"), {
                code: "ENOENT",
            });
        }),
        existsSync: vi.fn((path) => mockFileSystem.has(path)),
    };
    return {
        default: fsModule,
        ...fsModule,
    };
});
// Mock KaiDexClient and Config constructor
vi.mock("../core/client.js");
vi.mock("../config/config.js");
describe("checkNextSpeaker", () => {
    let chatInstance;
    let mockConfig;
    let mockKaiDexClient;
    const abortSignal = new AbortController().signal;
    beforeEach(() => {
        vi.resetAllMocks();
        mockConfig = {
            getProjectRoot: vi.fn().mockReturnValue("/test/project/root"),
            getSessionId: vi.fn().mockReturnValue("test-session-id"),
            getModel: () => "test-model",
            storage: {
                getProjectTempDir: vi.fn().mockReturnValue("/test/temp"),
            },
        };
        mockKaiDexClient = new KaiDexClient(mockConfig);
        // KaiDexChat will receive the mocked instances via the mocked GoogleGenAI constructor
        chatInstance = new KaiDexChat(mockConfig, {}, []);
        // Spy on getHistory for chatInstance
        vi.spyOn(chatInstance, "getHistory");
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    it("should return null if history is empty", async () => {
        chatInstance.getHistory.mockReturnValue([]);
        const result = await checkNextSpeaker(chatInstance, mockKaiDexClient, abortSignal);
        expect(result).toBeNull();
        expect(mockKaiDexClient.generateJson).not.toHaveBeenCalled();
    });
    it("should return null if the last speaker was the user", async () => {
        vi.mocked(chatInstance.getHistory).mockReturnValue([
            { role: "user", parts: [{ text: "Hello" }] },
        ]);
        const result = await checkNextSpeaker(chatInstance, mockKaiDexClient, abortSignal);
        expect(result).toBeNull();
        expect(mockKaiDexClient.generateJson).not.toHaveBeenCalled();
    });
    it("should return { next_speaker: 'model' } when model intends to continue", async () => {
        chatInstance.getHistory.mockReturnValue([
            { role: "model", parts: [{ text: "I will now do something." }] },
        ]);
        const mockApiResponse = {
            reasoning: "Model stated it will do something.",
            next_speaker: "model",
        };
        mockKaiDexClient.generateJson.mockResolvedValue(mockApiResponse);
        const result = await checkNextSpeaker(chatInstance, mockKaiDexClient, abortSignal);
        expect(result).toEqual(mockApiResponse);
        expect(mockKaiDexClient.generateJson).toHaveBeenCalledTimes(1);
    });
    it("should return { next_speaker: 'user' } when model asks a question", async () => {
        chatInstance.getHistory.mockReturnValue([
            { role: "model", parts: [{ text: "What would you like to do?" }] },
        ]);
        const mockApiResponse = {
            reasoning: "Model asked a question.",
            next_speaker: "user",
        };
        mockKaiDexClient.generateJson.mockResolvedValue(mockApiResponse);
        const result = await checkNextSpeaker(chatInstance, mockKaiDexClient, abortSignal);
        expect(result).toEqual(mockApiResponse);
    });
    it("should return { next_speaker: 'user' } when model makes a statement", async () => {
        chatInstance.getHistory.mockReturnValue([
            { role: "model", parts: [{ text: "This is a statement." }] },
        ]);
        const mockApiResponse = {
            reasoning: "Model made a statement, awaiting user input.",
            next_speaker: "user",
        };
        mockKaiDexClient.generateJson.mockResolvedValue(mockApiResponse);
        const result = await checkNextSpeaker(chatInstance, mockKaiDexClient, abortSignal);
        expect(result).toEqual(mockApiResponse);
    });
    it("should return null if geminiClient.generateJson throws an error", async () => {
        const consoleWarnSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => { });
        chatInstance.getHistory.mockReturnValue([
            { role: "model", parts: [{ text: "Some model output." }] },
        ]);
        mockKaiDexClient.generateJson.mockRejectedValue(new Error("API Error"));
        const result = await checkNextSpeaker(chatInstance, mockKaiDexClient, abortSignal);
        expect(result).toBeNull();
        consoleWarnSpy.mockRestore();
    });
    it("should return null if geminiClient.generateJson returns invalid JSON (missing next_speaker)", async () => {
        chatInstance.getHistory.mockReturnValue([
            { role: "model", parts: [{ text: "Some model output." }] },
        ]);
        mockKaiDexClient.generateJson.mockResolvedValue({
            reasoning: "This is incomplete.",
        }); // Type assertion to simulate invalid response
        const result = await checkNextSpeaker(chatInstance, mockKaiDexClient, abortSignal);
        expect(result).toBeNull();
    });
    it("should return null if geminiClient.generateJson returns a non-string next_speaker", async () => {
        chatInstance.getHistory.mockReturnValue([
            { role: "model", parts: [{ text: "Some model output." }] },
        ]);
        mockKaiDexClient.generateJson.mockResolvedValue({
            reasoning: "Model made a statement, awaiting user input.",
            next_speaker: 123, // Invalid type
        });
        const result = await checkNextSpeaker(chatInstance, mockKaiDexClient, abortSignal);
        expect(result).toBeNull();
    });
    it("should return null if geminiClient.generateJson returns an invalid next_speaker string value", async () => {
        chatInstance.getHistory.mockReturnValue([
            { role: "model", parts: [{ text: "Some model output." }] },
        ]);
        mockKaiDexClient.generateJson.mockResolvedValue({
            reasoning: "Model made a statement, awaiting user input.",
            next_speaker: "neither", // Invalid enum value
        });
        const result = await checkNextSpeaker(chatInstance, mockKaiDexClient, abortSignal);
        expect(result).toBeNull();
    });
    it("should call generateJson with DEFAULT_KAIDEX_FLASH_MODEL", async () => {
        chatInstance.getHistory.mockReturnValue([
            { role: "model", parts: [{ text: "Some model output." }] },
        ]);
        const mockApiResponse = {
            reasoning: "Model made a statement, awaiting user input.",
            next_speaker: "user",
        };
        mockKaiDexClient.generateJson.mockResolvedValue(mockApiResponse);
        await checkNextSpeaker(chatInstance, mockKaiDexClient, abortSignal);
        expect(mockKaiDexClient.generateJson).toHaveBeenCalled();
        const generateJsonCall = mockKaiDexClient.generateJson.mock
            .calls[0];
        expect(generateJsonCall[3]).toBe(DEFAULT_KAIDEX_FLASH_MODEL);
    });
});
//# sourceMappingURL=nextSpeakerChecker.test.js.map