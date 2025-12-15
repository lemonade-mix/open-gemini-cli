/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
export interface Message {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_call_id?: string;
    tool_calls?: Array<{
        id: string;
        type: string;
        function: {
            name: string;
            arguments: string;
        };
    }>;
}
export interface ChatCompletionResponse {
    id?: string;
    object?: string;
    created?: number;
    model?: string;
    choices: Array<{
        index?: number;
        message?: Message;
        finish_reason?: string;
        delta?: {
            content?: string;
            role?: string;
            tool_calls?: Array<{
                id: string;
                type: string;
                function: {
                    name: string;
                    arguments: string;
                };
            }>;
        };
    }>;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
    };
}
export interface ChatCompletionRequest {
    model: string;
    messages: Message[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    tools?: any[];
}
export interface TokenCountResponse {
    totalTokens: number;
}
export interface TokenCountRequest {
    messages: Message[];
}
export interface EmbeddingResponse {
    embedding: number[];
}
export interface EmbeddingRequest {
    input: string;
    model?: string;
}
export interface GenerateContentResponse {
    response: {
        candidates: Array<{
            content: {
                parts: Array<{
                    text: string;
                }>;
                role: string;
            };
            finishReason?: FinishReason | string;
            citationMetadata?: any;
            urlContextMetadata?: any;
            groundingMetadata?: any;
        }>;
    };
    candidates?: Array<{
        content: {
            parts: Array<{
                text: string;
            }>;
            role: string;
        };
        finishReason?: FinishReason | string;
        citationMetadata?: any;
        urlContextMetadata?: any;
        groundingMetadata?: any;
    }>;
    text?: () => string;
    data?: any;
    functionCalls?: any[];
    executableCode?: any;
    codeExecutionResult?: any;
    usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
    };
}
export interface GenerateContentParameters {
    contents: Content[];
    model?: string;
    config?: GenerateContentConfig & {
        abortSignal?: AbortSignal;
    };
}
export interface Content {
    role?: string;
    parts?: Part[];
}
export interface CountTokensParameters {
    contents?: Content[];
    model?: string;
}
export interface CountTokensResponse {
    totalTokens?: number;
}
export interface EmbedContentParameters {
    content: {
        parts: Array<{
            text: string;
        }>;
    };
    model?: string;
    contents?: Content[];
}
export interface EmbedContentResponse {
    embedding?: number[];
    embeddings?: number[];
}
export interface Part {
    text?: string;
    inlineData?: {
        mimeType?: string;
        data?: string;
    };
    fileData?: {
        mimeType?: string;
        fileUri?: string;
    };
    functionCall?: {
        id?: string;
        name?: string;
        args?: Record<string, any>;
    };
    functionResponse?: {
        id?: string;
        name?: string;
        response?: Record<string, any>;
    };
    executableCode?: {
        language?: string;
        code?: string;
    };
    codeExecutionResult?: {
        outcome?: string;
        output?: string;
    };
}
export type PartListUnion = Part[] | string;
export interface FunctionDeclaration {
    name: string;
    description?: string;
    parameters?: any;
}
export interface Schema {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
}
export declare enum Type {
    STRING = "STRING",
    NUMBER = "NUMBER",
    INTEGER = "INTEGER",
    BOOLEAN = "BOOLEAN",
    ARRAY = "ARRAY",
    OBJECT = "OBJECT"
}
export interface GenerateContentConfig {
    temperature?: number;
    topP?: number;
    topK?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    responseSchema?: Schema;
    responseJsonSchema?: Record<string, unknown>;
    stopSequences?: string[];
    presencePenalty?: number;
    frequencyPenalty?: number;
    systemInstruction?: string;
    tools?: Tool[];
    toolConfig?: {
        functionCallingConfig?: {
            mode?: "AUTO" | "ANY" | "NONE";
            allowedFunctionNames?: string[];
        };
    };
    thinkingConfig?: {
        thinkingBudget?: number;
    };
}
export interface Tool {
    functionDeclarations?: FunctionDeclaration[];
    codeExecution?: {};
    googleSearch?: {};
    urlContext?: {
        urls?: string[];
    };
}
export interface FunctionCall {
    id?: string;
    name: string;
    args: Record<string, any>;
}
export type FinishReason = "STOP" | "MAX_TOKENS" | "SAFETY" | "RECITATION" | "OTHER" | "BLOCKLIST" | "PROHIBITED_CONTENT" | "SPII" | "MALFORMED_FUNCTION_CALL";
import type { Config } from "../config/config.js";
import type { UserTierId } from "../code_assist/types.js";
import { InstallationManager } from "../utils/installationManager.js";
/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 * Uses OpenAI-compatible types as primary interface.
 */
export interface ContentGenerator {
    chatCompletion(request: ChatCompletionRequest, userPromptId: string): Promise<ChatCompletionResponse>;
    chatCompletionStream(request: ChatCompletionRequest, userPromptId: string): AsyncGenerator<ChatCompletionResponse>;
    generateContent(request: GenerateContentParameters, userPromptId: string): Promise<GenerateContentResponse>;
    generateContentStream(request: GenerateContentParameters, userPromptId: string): AsyncGenerator<GenerateContentResponse>;
    countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;
    embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;
    userTier?: UserTierId;
}
export declare enum AuthType {
    LOGIN_WITH_GOOGLE = "oauth-personal",
    USE_GEMINI = "gemini-api-key",
    USE_VERTEX_AI = "vertex-ai",
    CLOUD_SHELL = "cloud-shell",
    LOCAL_LLM = "local-llm"
}
/**
 * Configuration for the content generator
 */
export interface ContentGeneratorConfig {
    authType?: AuthType;
    baseURL?: string;
    endpoint?: string;
    apiKey?: string;
    model?: string;
    userTier?: UserTierId;
    headers?: Record<string, string>;
    maxInputTokens?: number;
    maxOutputTokens?: number;
}
/**
 * Creates content generator instances based on configuration
 */
export declare function createContentGenerator(configOrContentGeneratorConfig: Config | ContentGeneratorConfig, config?: Config, sessionId?: string): Promise<ContentGenerator>;
/**
 * Helper to get content generator or fail
 */
export declare function getContentGeneratorOrFail(config: Config): Promise<ContentGenerator>;
/**
 * Create content generator configuration
 */
export declare function createContentGeneratorConfig(config: any, authMethod?: AuthType): ContentGeneratorConfig;
export { InstallationManager };
