/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { ApiRequestEvent, ApiResponseEvent, ApiErrorEvent, } from "../telemetry/types.js";
import { logApiError, logApiRequest, logApiResponse, } from "../telemetry/loggers.js";
import { isStructuredError } from "../utils/quotaErrorDetection.js";
/**
 * A decorator that wraps a ContentGenerator to add logging to API calls.
 */
export class LoggingContentGenerator {
    wrapped;
    config;
    constructor(wrapped, config) {
        this.wrapped = wrapped;
        this.config = config;
    }
    getWrapped() {
        return this.wrapped;
    }
    logApiRequest(contents, model, promptId) {
        const requestText = JSON.stringify(contents);
        logApiRequest(this.config, new ApiRequestEvent(model, promptId, requestText));
    }
    _logApiResponse(durationMs, model, prompt_id, usageMetadata, responseText) {
        logApiResponse(this.config, new ApiResponseEvent(model, durationMs, prompt_id, this.config.getContentGeneratorConfig()?.authType, usageMetadata, responseText));
    }
    _logApiError(durationMs, error, model, prompt_id) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorType = error instanceof Error ? error.name : "unknown";
        logApiError(this.config, new ApiErrorEvent(model, errorMessage, durationMs, prompt_id, this.config.getContentGeneratorConfig()?.authType, errorType, isStructuredError(error)
            ? error.status
            : undefined));
    }
    async generateContent(req, userPromptId) {
        const startTime = Date.now();
        const modelName = req.model || "unknown";
        this.logApiRequest(req.contents, modelName, userPromptId);
        try {
            const response = await this.wrapped.generateContent(req, userPromptId);
            const durationMs = Date.now() - startTime;
            this._logApiResponse(durationMs, modelName, userPromptId, response.usageMetadata, JSON.stringify(response));
            return response;
        }
        catch (error) {
            const durationMs = Date.now() - startTime;
            this._logApiError(durationMs, error, modelName, userPromptId);
            throw error;
        }
    }
    async *generateContentStream(req, userPromptId) {
        const startTime = Date.now();
        const modelName = req.model || "unknown";
        this.logApiRequest(req.contents, modelName, userPromptId);
        let stream;
        try {
            stream = this.wrapped.generateContentStream(req, userPromptId);
        }
        catch (error) {
            const durationMs = Date.now() - startTime;
            this._logApiError(durationMs, error, modelName, userPromptId);
            throw error;
        }
        yield* this.loggingStreamWrapper(stream, startTime, userPromptId, modelName);
    }
    async *loggingStreamWrapper(stream, startTime, userPromptId, modelName) {
        const responses = [];
        let lastUsageMetadata;
        try {
            for await (const response of stream) {
                responses.push(response);
                if (response.usageMetadata) {
                    lastUsageMetadata = response.usageMetadata;
                }
                yield response;
            }
            // Only log successful API response if no error occurred
            const durationMs = Date.now() - startTime;
            this._logApiResponse(durationMs, modelName, userPromptId, lastUsageMetadata, JSON.stringify(responses));
        }
        catch (error) {
            const durationMs = Date.now() - startTime;
            this._logApiError(durationMs, error, modelName, userPromptId);
            throw error;
        }
    }
    async countTokens(req) {
        return this.wrapped.countTokens(req);
    }
    async embedContent(req) {
        return this.wrapped.embedContent(req);
    }
    // OpenAI-compatible primary interface methods
    chatCompletion(request, userPromptId) {
        return this.wrapped.chatCompletion(request, userPromptId);
    }
    chatCompletionStream(request, userPromptId) {
        return this.wrapped.chatCompletionStream(request, userPromptId);
    }
}
//# sourceMappingURL=loggingContentGenerator.js.map