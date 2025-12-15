/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { CountTokensParameters, CountTokensResponse, EmbedContentParameters, EmbedContentResponse, GenerateContentParameters, GenerateContentResponse } from "./contentGenerator.js";
export interface GenerateContentResponseUsageMetadata {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    cachedContentTokenCount?: number;
    thoughtsTokenCount?: number;
    toolUsePromptTokenCount?: number;
}
import type { Config } from "../config/config.js";
import type { ContentGenerator } from "./contentGenerator.js";
/**
 * A decorator that wraps a ContentGenerator to add logging to API calls.
 */
export declare class LoggingContentGenerator implements ContentGenerator {
    private readonly wrapped;
    private readonly config;
    constructor(wrapped: ContentGenerator, config: Config);
    getWrapped(): ContentGenerator;
    private logApiRequest;
    private _logApiResponse;
    private _logApiError;
    generateContent(req: GenerateContentParameters, userPromptId: string): Promise<GenerateContentResponse>;
    generateContentStream(req: GenerateContentParameters, userPromptId: string): AsyncGenerator<GenerateContentResponse, any, any>;
    private loggingStreamWrapper;
    countTokens(req: CountTokensParameters): Promise<CountTokensResponse>;
    embedContent(req: EmbedContentParameters): Promise<EmbedContentResponse>;
    chatCompletion(request: any, userPromptId: string): Promise<any>;
    chatCompletionStream(request: any, userPromptId: string): AsyncGenerator<any>;
}
