/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { getResponseText } from "../utils/partUtils.js";
import { reportError } from "../utils/errorReporting.js";
import { getErrorMessage, UnauthorizedError, toFriendlyError, } from "../utils/errors.js";
import { createKaidexUserContent } from "./kaidexChat.js";
export var KaiDexEventType;
(function (KaiDexEventType) {
    KaiDexEventType["Content"] = "content";
    KaiDexEventType["ToolCallRequest"] = "tool_call_request";
    KaiDexEventType["ToolCallResponse"] = "tool_call_response";
    KaiDexEventType["ToolCallConfirmation"] = "tool_call_confirmation";
    KaiDexEventType["UserCancelled"] = "user_cancelled";
    KaiDexEventType["Error"] = "error";
    KaiDexEventType["ChatCompressed"] = "chat_compressed";
    KaiDexEventType["Thought"] = "thought";
    KaiDexEventType["MaxSessionTurns"] = "max_session_turns";
    KaiDexEventType["Finished"] = "finished";
    KaiDexEventType["LoopDetected"] = "loop_detected";
    KaiDexEventType["Citation"] = "citation";
    KaiDexEventType["Retry"] = "retry";
})(KaiDexEventType || (KaiDexEventType = {}));
export var CompressionStatus;
(function (CompressionStatus) {
    /** The compression was successful */
    CompressionStatus[CompressionStatus["COMPRESSED"] = 1] = "COMPRESSED";
    /** The compression failed due to the compression inflating the token count */
    CompressionStatus[CompressionStatus["COMPRESSION_FAILED_INFLATED_TOKEN_COUNT"] = 2] = "COMPRESSION_FAILED_INFLATED_TOKEN_COUNT";
    /** The compression failed due to an error counting tokens */
    CompressionStatus[CompressionStatus["COMPRESSION_FAILED_TOKEN_COUNT_ERROR"] = 3] = "COMPRESSION_FAILED_TOKEN_COUNT_ERROR";
    /** The compression was not necessary and no action was taken */
    CompressionStatus[CompressionStatus["NOOP"] = 4] = "NOOP";
})(CompressionStatus || (CompressionStatus = {}));
// A turn manages the agentic loop turn within the server context.
export class Turn {
    chat;
    prompt_id;
    pendingToolCalls = [];
    debugResponses = [];
    pendingCitations = new Set();
    finishReason = undefined;
    constructor(chat, prompt_id) {
        this.chat = chat;
        this.prompt_id = prompt_id;
    }
    // The run method yields simpler events suitable for server logic
    async *run(req, signal) {
        try {
            // Note: This assumes `sendMessageStream` yields events like
            // { type: StreamEventType.RETRY } or { type: StreamEventType.CHUNK, value: GenerateContentResponse }
            const responseStream = await this.chat.sendMessageStream({
                message: req,
                config: {
                    abortSignal: signal,
                },
            }, this.prompt_id);
            for await (const streamEvent of responseStream) {
                console.log(streamEvent.type);
                if (signal?.aborted) {
                    yield { type: KaiDexEventType.UserCancelled };
                    return;
                }
                // Handle the new RETRY event
                if (streamEvent.type === "retry") {
                    yield { type: KaiDexEventType.Retry };
                    continue; // Skip to the next event in the stream
                }
                // Assuming other events are chunks with a `value` property
                const resp = streamEvent.value;
                console.log(resp?.functionCalls?.length || 0);
                if (!resp)
                    continue; // Skip if there's no response body
                this.debugResponses.push(resp);
                const thoughtPart = resp.candidates?.[0]?.content?.parts?.[0];
                if (thoughtPart?.thought) {
                    // Thought always has a bold "subject" part enclosed in double asterisks
                    // (e.g., **Subject**). The rest of the string is considered the description.
                    const rawText = thoughtPart?.text ?? "";
                    const subjectStringMatches = rawText.match(/\*\*(.*?)\*\*/s);
                    const subject = subjectStringMatches
                        ? subjectStringMatches[1].trim()
                        : "";
                    const description = rawText.replace(/\*\*(.*?)\*\*/s, "").trim();
                    const thought = {
                        subject,
                        description,
                    };
                    yield {
                        type: KaiDexEventType.Thought,
                        value: thought,
                    };
                    continue;
                }
                const text = getResponseText(resp);
                if (text) {
                    yield { type: KaiDexEventType.Content, value: text };
                }
                // Handle function calls (requesting tool execution)
                const functionCalls = resp.functionCalls ?? [];
                console.log(functionCalls.length);
                for (const fnCall of functionCalls) {
                    console.log(fnCall.name, "args:", fnCall.args);
                    const event = this.handlePendingFunctionCall(fnCall);
                    if (event) {
                        yield event;
                        console.log();
                    }
                }
                for (const citation of getCitations(resp)) {
                    this.pendingCitations.add(citation);
                }
                // Check if response was truncated or stopped for various reasons
                const finishReason = resp.candidates?.[0]?.finishReason;
                // This is the key change: Only yield 'Finished' if there is a finishReason.
                if (finishReason) {
                    if (this.pendingCitations.size > 0) {
                        yield {
                            type: KaiDexEventType.Citation,
                            value: `Citations:\n${[...this.pendingCitations].sort().join("\n")}`,
                        };
                        this.pendingCitations.clear();
                    }
                    this.finishReason = finishReason;
                    yield {
                        type: KaiDexEventType.Finished,
                        value: {
                            reason: finishReason,
                            usageMetadata: resp.usageMetadata,
                        },
                    };
                }
            }
        }
        catch (e) {
            if (signal.aborted) {
                yield { type: KaiDexEventType.UserCancelled };
                // Regular cancellation error, fail gracefully.
                return;
            }
            const error = toFriendlyError(e);
            if (error instanceof UnauthorizedError) {
                throw error;
            }
            const reqContent = createKaidexUserContent(req);
            const contextForReport = [
                ...this.chat.getHistory(/*curated*/ true),
                reqContent,
            ];
            await reportError(error, "Error when talking to KaiDex API", contextForReport, "Turn.run-sendMessageStream");
            const status = typeof error === "object" &&
                error !== null &&
                "status" in error &&
                typeof error.status === "number"
                ? error.status
                : undefined;
            const structuredError = {
                message: getErrorMessage(error),
                status,
            };
            await this.chat.maybeIncludeSchemaDepthContext(structuredError);
            yield { type: KaiDexEventType.Error, value: { error: structuredError } };
            return;
        }
    }
    handlePendingFunctionCall(fnCall) {
        const callId = fnCall.id ??
            `${fnCall.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const name = fnCall.name || "undefined_tool_name";
        const args = (fnCall.args || {});
        const toolCallRequest = {
            callId,
            name,
            args,
            isClientInitiated: false,
            prompt_id: this.prompt_id,
        };
        this.pendingToolCalls.push(toolCallRequest);
        // Yield a request for the tool call, not the pending/confirming status
        return { type: KaiDexEventType.ToolCallRequest, value: toolCallRequest };
    }
    getDebugResponses() {
        return this.debugResponses;
    }
    clearPendingToolCalls() {
        this.pendingToolCalls.length = 0;
    }
}
function getCitations(resp) {
    return (resp.candidates?.[0]?.citationMetadata?.citations ?? [])
        .filter((citation) => citation.uri !== undefined)
        .map((citation) => {
        if (citation.title) {
            return `(${citation.title}) ${citation.uri}`;
        }
        return citation.uri;
    });
}
//# sourceMappingURL=turn.js.map