/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Part, PartListUnion, GenerateContentResponse, FunctionDeclaration, FinishReason } from "./contentGenerator.js";
import type { GenerateContentResponseUsageMetadata } from "./loggingContentGenerator.js";
import type { ToolCallConfirmationDetails, ToolResult, ToolResultDisplay } from "../tools/tools.js";
import type { ToolErrorType } from "../tools/tool-error.js";
import type { KaiDexChat } from "./kaidexChat.js";
export interface ServerTool {
    name: string;
    schema: FunctionDeclaration;
    execute(params: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult>;
    shouldConfirmExecute(params: Record<string, unknown>, abortSignal: AbortSignal): Promise<ToolCallConfirmationDetails | false>;
}
export declare enum KaiDexEventType {
    Content = "content",
    ToolCallRequest = "tool_call_request",
    ToolCallResponse = "tool_call_response",
    ToolCallConfirmation = "tool_call_confirmation",
    UserCancelled = "user_cancelled",
    Error = "error",
    ChatCompressed = "chat_compressed",
    Thought = "thought",
    MaxSessionTurns = "max_session_turns",
    Finished = "finished",
    LoopDetected = "loop_detected",
    Citation = "citation",
    Retry = "retry"
}
export type ServerKaiDexRetryEvent = {
    type: KaiDexEventType.Retry;
};
export interface StructuredError {
    message: string;
    status?: number;
}
export interface KaiDexErrorEventValue {
    error: StructuredError;
}
export interface KaiDexFinishedEventValue {
    reason: FinishReason | undefined;
    usageMetadata: GenerateContentResponseUsageMetadata | undefined;
}
export interface ToolCallRequestInfo {
    callId: string;
    name: string;
    args: Record<string, unknown>;
    isClientInitiated: boolean;
    prompt_id: string;
}
export interface ToolCallResponseInfo {
    callId: string;
    responseParts: Part[];
    resultDisplay: ToolResultDisplay | undefined;
    error: Error | undefined;
    errorType: ToolErrorType | undefined;
    outputFile?: string | undefined;
}
export interface ServerToolCallConfirmationDetails {
    request: ToolCallRequestInfo;
    details: ToolCallConfirmationDetails;
}
export type ThoughtSummary = {
    subject: string;
    description: string;
};
export type ServerKaiDexContentEvent = {
    type: KaiDexEventType.Content;
    value: string;
};
export type ServerKaiDexThoughtEvent = {
    type: KaiDexEventType.Thought;
    value: ThoughtSummary;
};
export type ServerKaiDexToolCallRequestEvent = {
    type: KaiDexEventType.ToolCallRequest;
    value: ToolCallRequestInfo;
};
export type ServerKaiDexToolCallResponseEvent = {
    type: KaiDexEventType.ToolCallResponse;
    value: ToolCallResponseInfo;
};
export type ServerKaiDexToolCallConfirmationEvent = {
    type: KaiDexEventType.ToolCallConfirmation;
    value: ServerToolCallConfirmationDetails;
};
export type ServerKaiDexUserCancelledEvent = {
    type: KaiDexEventType.UserCancelled;
};
export type ServerKaiDexErrorEvent = {
    type: KaiDexEventType.Error;
    value: KaiDexErrorEventValue;
};
export declare enum CompressionStatus {
    /** The compression was successful */
    COMPRESSED = 1,
    /** The compression failed due to the compression inflating the token count */
    COMPRESSION_FAILED_INFLATED_TOKEN_COUNT = 2,
    /** The compression failed due to an error counting tokens */
    COMPRESSION_FAILED_TOKEN_COUNT_ERROR = 3,
    /** The compression was not necessary and no action was taken */
    NOOP = 4
}
export interface ChatCompressionInfo {
    originalTokenCount: number;
    newTokenCount: number;
    compressionStatus: CompressionStatus;
}
export type ServerKaiDexChatCompressedEvent = {
    type: KaiDexEventType.ChatCompressed;
    value: ChatCompressionInfo | null;
};
export type ServerKaiDexMaxSessionTurnsEvent = {
    type: KaiDexEventType.MaxSessionTurns;
};
export type ServerKaiDexFinishedEvent = {
    type: KaiDexEventType.Finished;
    value: KaiDexFinishedEventValue;
};
export type ServerKaiDexLoopDetectedEvent = {
    type: KaiDexEventType.LoopDetected;
};
export type ServerKaiDexCitationEvent = {
    type: KaiDexEventType.Citation;
    value: string;
};
export type ServerKaiDexStreamEvent = ServerKaiDexChatCompressedEvent | ServerKaiDexCitationEvent | ServerKaiDexContentEvent | ServerKaiDexErrorEvent | ServerKaiDexFinishedEvent | ServerKaiDexLoopDetectedEvent | ServerKaiDexMaxSessionTurnsEvent | ServerKaiDexThoughtEvent | ServerKaiDexToolCallConfirmationEvent | ServerKaiDexToolCallRequestEvent | ServerKaiDexToolCallResponseEvent | ServerKaiDexUserCancelledEvent | ServerKaiDexRetryEvent;
export declare class Turn {
    private readonly chat;
    private readonly prompt_id;
    pendingToolCalls: ToolCallRequestInfo[];
    private debugResponses;
    private pendingCitations;
    finishReason: FinishReason | undefined;
    constructor(chat: KaiDexChat, prompt_id: string);
    run(req: PartListUnion, signal: AbortSignal): AsyncGenerator<ServerKaiDexStreamEvent>;
    private handlePendingFunctionCall;
    getDebugResponses(): GenerateContentResponse[];
    clearPendingToolCalls(): void;
}
