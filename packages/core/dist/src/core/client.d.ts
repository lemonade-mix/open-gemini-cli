/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { GenerateContentConfig, PartListUnion, Content, GenerateContentResponse } from "./contentGenerator.js";
import type { ServerKaiDexStreamEvent, ChatCompressionInfo } from "./turn.js";
import { Turn } from "./turn.js";
import type { Config } from "../config/config.js";
import { KaiDexChat } from "./kaidexChat.js";
import type { ChatRecordingService } from "../services/chatRecordingService.js";
export declare function isThinkingSupported(model: string): boolean;
export declare function isThinkingDefault(model: string): boolean;
/**
 * Returns the index of the content after the fraction of the total characters in the history.
 *
 * Exported for testing purposes.
 */
export declare function findIndexAfterFraction(history: Content[], fraction: number): number;
export declare class KaiDexClient {
    private readonly config;
    private chat?;
    private readonly generateContentConfig;
    private sessionTurnCount;
    private readonly loopDetector;
    private lastPromptId;
    private lastSentIdeContext;
    private forceFullIdeContext;
    /**
     * At any point in this conversation, was compression triggered without
     * being forced and did it fail?
     */
    private hasFailedCompressionAttempt;
    constructor(config: Config);
    initialize(): Promise<void>;
    private getContentGeneratorOrFail;
    addHistory(content: Content): Promise<void>;
    getChat(): KaiDexChat;
    isInitialized(): boolean;
    getHistory(): Content[];
    stripThoughtsFromHistory(): void;
    setHistory(history: Content[]): void;
    setTools(): Promise<void>;
    resetChat(): Promise<void>;
    getChatRecordingService(): ChatRecordingService | undefined;
    addDirectoryContext(): Promise<void>;
    startChat(extraHistory?: Content[]): Promise<KaiDexChat>;
    private getIdeContextParts;
    sendMessageStream(request: PartListUnion, signal: AbortSignal, prompt_id: string, turns?: number, originalModel?: string): AsyncGenerator<ServerKaiDexStreamEvent, Turn>;
    generateJson(contents: Content[], schema: Record<string, unknown>, abortSignal: AbortSignal, model: string, config?: GenerateContentConfig, caller?: string): Promise<Record<string, unknown>>;
    generateContent(contents: Content[], generationConfig: GenerateContentConfig, abortSignal: AbortSignal, model: string): Promise<GenerateContentResponse>;
    generateEmbedding(texts: string[]): Promise<number[][]>;
    tryCompressChat(prompt_id: string, force?: boolean): Promise<ChatCompressionInfo>;
}
export declare const TEST_ONLY: {
    COMPRESSION_PRESERVE_THRESHOLD: number;
    COMPRESSION_TOKEN_THRESHOLD: number;
};
