/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
export var Type;
(function (Type) {
    Type["STRING"] = "STRING";
    Type["NUMBER"] = "NUMBER";
    Type["INTEGER"] = "INTEGER";
    Type["BOOLEAN"] = "BOOLEAN";
    Type["ARRAY"] = "ARRAY";
    Type["OBJECT"] = "OBJECT";
})(Type || (Type = {}));
import { DEFAULT_KAIDEX_MODEL } from "../config/models.js";
import { LoggingContentGenerator } from "./loggingContentGenerator.js";
import { InstallationManager } from "../utils/installationManager.js";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
/**
 * Start MLX supervisor if not already running
 * Returns true if supervisor was started, false if already running
 */
async function ensureMlxSupervisor(baseURL) {
    try {
        // Only start supervisor for localhost MLX servers
        if (!baseURL.includes("localhost") && !baseURL.includes("127.0.0.1")) {
            return false;
        }
        // Extract port from baseURL (e.g., "http://localhost:11453/v1" -> "11453")
        const portMatch = baseURL.match(/:(\d+)/);
        if (!portMatch) {
            console.warn("Could not extract port from baseURL for supervisor");
            return false;
        }
        const port = portMatch[1];
        // Default model name (can be made configurable later)
        const modelName = process.env["MLX_MODEL_NAME"] || "Qwen3-Coder-MLX-4bit-REAL";
        const lockFile = `/tmp/mlx-supervisor-${modelName}.lock`;
        // Check if supervisor is already running
        if (fs.existsSync(lockFile)) {
            const supervisorPid = fs.readFileSync(lockFile, "utf-8").trim();
            try {
                // Check if process is still alive
                process.kill(parseInt(supervisorPid), 0);
                console.log(`✓ MLX supervisor already running (PID: ${supervisorPid})`);
                return false;
            }
            catch {
                // Lock file exists but process is dead, clean up
                fs.unlinkSync(lockFile);
            }
        }
        // Find supervisor script relative to this file
        const currentFile = fileURLToPath(import.meta.url);
        const projectRoot = path.resolve(path.dirname(currentFile), "../../../..");
        const supervisorScript = path.join(projectRoot, "scripts/mlx-supervisor.sh");
        if (!fs.existsSync(supervisorScript)) {
            console.warn(`MLX supervisor script not found at ${supervisorScript}`);
            return false;
        }
        // Start supervisor in background
        console.log(`🔄 Starting MLX supervisor for ${modelName} on port ${port}...`);
        const child = spawn(supervisorScript, [modelName, port], {
            detached: true,
            stdio: "ignore",
            shell: true,
        });
        child.unref();
        // Give it a moment to start
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log(`✓ MLX supervisor started`);
        return true;
    }
    catch (error) {
        console.warn(`Failed to start MLX supervisor: ${error}`);
        return false;
    }
}
export var AuthType;
(function (AuthType) {
    AuthType["LOGIN_WITH_GOOGLE"] = "oauth-personal";
    AuthType["USE_GEMINI"] = "gemini-api-key";
    AuthType["USE_VERTEX_AI"] = "vertex-ai";
    AuthType["CLOUD_SHELL"] = "cloud-shell";
    AuthType["LOCAL_LLM"] = "local-llm";
})(AuthType || (AuthType = {}));
function isAssistantWithDanglingToolCalls(msgs) {
    // Scan from start: any assistant with tool_calls must be immediately followed by N matching tool messages
    for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        if (m?.role === "assistant" &&
            Array.isArray(m.tool_calls) &&
            m.tool_calls.length > 0) {
            const calls = m.tool_calls;
            for (let j = 0; j < calls.length; j++) {
                const next = msgs[i + 1 + j];
                const expectedId = calls[j]?.id;
                if (!next || next.role !== "tool" || next.tool_call_id !== expectedId) {
                    return i;
                }
            }
        }
    }
    return -1;
}
function ensureAlternation(msgs) {
    for (let i = 1; i < msgs.length; i++) {
        const prev = msgs[i - 1];
        const cur = msgs[i];
        if (prev.role === "user" && cur.role === "user") {
            // Insert tiny assistant shim to restore alternation
            const repaired = msgs
                .slice(0, i)
                .concat([{ role: "assistant", content: "OK." }], msgs.slice(i));
            return { msgs: repaired, repaired: true };
        }
    }
    return { msgs, repaired: false };
}
function capToolOutput(text) {
    const max = parseInt(process.env["KAIDEX_TOOL_OUTPUT_MAX_CHARS"] || "8000", 10);
    if (!Number.isFinite(max) || max <= 0)
        return text;
    if (text.length <= max)
        return text;
    return text.slice(0, max) + "\n[truncated]";
}
function logApiErrorToTmp(prefix, url, status, statusText, errorText, meta) {
    try {
        const ts = new Date().toISOString();
        const logPath = `/tmp/kaidex_errors_${ts.slice(0, 10)}.log`;
        const entry = [
            `[${ts}] ${prefix} ${status} ${statusText} url=${url}`,
            `meta=${JSON.stringify(meta)}`,
            `error=${errorText}`,
        ].join("\n") + "\n";
        fs.appendFileSync(logPath, entry);
    }
    catch { }
}
// Very rough token estimate guard: chars/4
function estimateTokensOfMessages(msgs) {
    let chars = 0;
    for (const m of msgs) {
        if (m?.content)
            chars += m.content.length;
    }
    return Math.ceil(chars / 4);
}
function trimToBudget(msgsIn, modelMaxInputTokens, toolsOverhead) {
    // Get model-specific limit or fall back to env var or default
    const hardStr = process.env["KAIDEX_MAX_CONTEXT_TOKENS"];
    const softStr = process.env["KAIDEX_SOFT_CONTEXT_TOKENS"];
    const hard = modelMaxInputTokens || (hardStr ? parseInt(hardStr, 10) : 400000);
    const soft = softStr ? parseInt(softStr, 10) : Math.floor(hard * 0.85);
    // Calculate actual overhead: tools + system prompt + estimation error
    // Estimation error: chars/4 can be off by ~30%, so reserve 30% for safety
    const estimationErrorMargin = Math.floor(hard * 0.3);
    const actualToolsOverhead = toolsOverhead || 0;
    const totalOverhead = estimationErrorMargin + actualToolsOverhead;
    const effectiveLimit = Math.min(soft, hard - totalOverhead);
    let msgs = msgsIn.slice();
    // Always keep first system message if present
    const sys = msgs.findIndex((m) => m.role === "system");
    const systemMsg = sys >= 0 ? msgs[sys] : undefined;
    if (sys >= 0)
        msgs.splice(sys, 1); // remove system for now
    // Keep last N messages strongly
    const keepLastTurns = parseInt(process.env["KAIDEX_KEEP_LAST_TURNS"] || "12", 10);
    const tail = msgs.slice(-keepLastTurns);
    let head = msgs.slice(0, Math.max(0, msgs.length - keepLastTurns));
    // Drop oldest head until under effective limit (with safety margin)
    let candidate = (systemMsg ? [systemMsg] : []).concat(head, tail);
    while (estimateTokensOfMessages(candidate) > effectiveLimit &&
        head.length > 0) {
        head.shift();
        candidate = (systemMsg ? [systemMsg] : []).concat(head, tail);
    }
    // Final safety check: if still too large, trim from tail too
    while (estimateTokensOfMessages(candidate) > effectiveLimit &&
        candidate.length > keepLastTurns / 2) {
        // Find first non-system message and remove it
        const firstNonSystem = candidate.findIndex((m) => m.role !== "system");
        if (firstNonSystem >= 0) {
            candidate.splice(firstNonSystem, 1);
        }
        else {
            break;
        }
    }
    return candidate;
}
function preSendRepair(input, allowTools, modelMaxInputTokens, toolsOverhead) {
    let msgs = input.slice();
    let repaired = false;
    // 1) Sanitize content FIRST: ensure content is never null/undefined (required by OpenAI API)
    msgs = msgs.map((m) => {
        const content = m.content;
        if (content === null || content === undefined) {
            // Assistant messages with tool_calls can have empty string content
            return { ...m, content: "" };
        }
        return m;
    });
    // 2) Strip assistant tool_calls and any immediate tool messages if not properly followed
    const idx = isAssistantWithDanglingToolCalls(msgs);
    if (idx >= 0) {
        let k = idx + 1;
        while (k < msgs.length && msgs[k]?.role === "tool")
            k++;
        // Remove the invalid assistant turn and any consecutive tool messages after it, keep later user/assistant turns
        msgs = msgs.slice(0, idx).concat(msgs.slice(k));
        repaired = true;
    }
    // 3) Enforce alternation
    const alt = ensureAlternation(msgs);
    msgs = alt.msgs;
    repaired = repaired || alt.repaired;
    // 4) If tools not allowed, strip tool messages and assistant.tool_calls
    if (!allowTools) {
        const filtered = msgs
            .filter((m) => m.role !== "tool")
            .map((m) => m.role === "assistant" ? { ...m, tool_calls: undefined } : m);
        if (filtered.length !== msgs.length)
            repaired = true;
        msgs = filtered;
    }
    // 5) Trim to token budget (with safety margin)
    const trimmed = trimToBudget(msgs, modelMaxInputTokens, toolsOverhead);
    if (trimmed.length !== msgs.length)
        repaired = true;
    msgs = trimmed;
    // 6) Final validation: ensure no dangling tool_calls after trimming
    const finalIdx = isAssistantWithDanglingToolCalls(msgs);
    if (finalIdx >= 0) {
        // Strip tool_calls from the dangling assistant message rather than removing it
        const danglingMsg = msgs[finalIdx];
        msgs[finalIdx] = { ...danglingMsg, tool_calls: undefined };
        repaired = true;
    }
    // 7) Ensure all messages have valid content field
    msgs = msgs.map((m) => {
        const content = m.content;
        if (typeof content !== "string") {
            return { ...m, content: "" };
        }
        return m;
    });
    return { msgs, allowTools, repaired };
}
// === End KaiDex pre-send safety helpers ===
/**
 * Local LLM Content Generator - Primary OpenAI interface with Gemini compatibility
 */
class LocalLLMContentGenerator {
    baseURL;
    endpoint;
    model;
    userTier;
    headers;
    isCloudAPI;
    maxInputTokens;
    maxOutputTokens;
    constructor(config) {
        // Don't use fallback for cloud APIs - config.baseURL should always be set by provider loader
        if (!config.baseURL) {
            throw new Error("baseURL is required in ContentGeneratorConfig");
        }
        this.baseURL = config.baseURL;
        this.endpoint = config.endpoint ?? "/chat/completions";
        this.model = config.model || DEFAULT_KAIDEX_MODEL;
        this.userTier = config.userTier;
        this.maxInputTokens = config.maxInputTokens;
        this.maxOutputTokens = config.maxOutputTokens;
        this.headers = config.headers || {
            "Content-Type": "application/json",
            Authorization: "Bearer local-llm",
        };
        // Detect if this is a cloud API (OpenAI/Claude/Google) vs local LLM
        this.isCloudAPI =
            this.baseURL.includes("openai.com") ||
                this.baseURL.includes("anthropic.com") ||
                this.baseURL.includes("googleapis.com");
    }
    // ==================== PRIMARY OPENAI INTERFACE ====================
    /**
     * Primary OpenAI chat completion method
     */
    async chatCompletion(request, userPromptId) {
        try {
            const url2 = this.baseURL + this.endpoint;
            if (this.isCompletionsEndpoint()) {
                const reqBody = {
                    model: this.model,
                    prompt: this.linearizeMessages(request.messages),
                    max_tokens: request.max_tokens,
                    stream: false,
                };
                if (request.tools && request.tools.length > 0) {
                    console.warn("Tools are not supported on /completions. Ignoring tools.");
                }
                const resp = await fetch(url2, {
                    method: "POST",
                    headers: this.headers,
                    body: JSON.stringify(reqBody),
                });
                if (!resp.ok) {
                    const errText = await resp.text().catch(() => "");
                    throw new Error("KaiDex Server API error: " +
                        resp.status +
                        " " +
                        resp.statusText +
                        ". " +
                        errText);
                }
                const json = await resp.json();
                return this.mapCompletionsToChat(json);
            }
            if (this.isResponsesEndpoint()) {
                const allowTools = !!(request.tools && request.tools.length > 0) &&
                    process.env["KAIDEX_DISABLE_TOOLS"] !== "1";
                // Convert OpenAI messages to /responses format
                const responsesInput = request.messages.flatMap((msg) => {
                    if (msg.role === "tool") {
                        // Convert tool result to function_call_output format
                        return [
                            {
                                type: "function_call_output",
                                call_id: msg.tool_call_id,
                                output: msg.content,
                            },
                        ];
                    }
                    else if (msg.role === "assistant" && msg.tool_calls) {
                        // Convert tool_calls to function_call objects for /responses
                        return msg.tool_calls.map((tc) => ({
                            type: "function_call",
                            call_id: tc.id,
                            name: tc.function.name,
                            arguments: tc.function.arguments,
                        }));
                    }
                    else {
                        // Regular user/assistant/system messages
                        return [
                            {
                                role: msg.role,
                                content: msg.content,
                            },
                        ];
                    }
                });
                const reqBody = {
                    model: this.model,
                    input: responsesInput,
                    max_output_tokens: request.max_tokens,
                    tool_choice: allowTools ? "auto" : "none",
                };
                if (allowTools && request.tools) {
                    // Convert from nested chat/completions format to flat responses format
                    reqBody.tools = request.tools.map((tool) => ({
                        type: tool.type,
                        name: tool.function.name,
                        description: tool.function.description,
                        parameters: tool.function.parameters,
                    }));
                }
                const resp = await fetch(url2, {
                    method: "POST",
                    headers: this.headers,
                    body: JSON.stringify(reqBody),
                });
                if (!resp.ok) {
                    const errText = await resp.text().catch(() => "");
                    throw new Error("KaiDex Server API error: " +
                        resp.status +
                        " " +
                        resp.statusText +
                        ". " +
                        errText);
                }
                const json = await resp.json();
                // Check for function_call in the response (non-stream)
                try {
                    const output = Array.isArray(json?.output) ? json.output : [];
                    const functionCalls = [];
                    // /responses returns function_call directly in output array
                    for (const item of output) {
                        if (item?.type === "function_call") {
                            functionCalls.push(item);
                        }
                    }
                    if (functionCalls.length > 0) {
                        const toolCalls = functionCalls.map((fc) => ({
                            id: fc.call_id,
                            type: "function",
                            function: {
                                name: fc.name,
                                arguments: fc.arguments, // Already a JSON string
                            },
                        }));
                        return {
                            id: json?.id,
                            model: json?.model,
                            choices: [
                                {
                                    index: 0,
                                    message: {
                                        role: "assistant",
                                        content: "",
                                        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
                                    },
                                    finish_reason: "tool_calls",
                                },
                            ],
                            usage: json?.usage
                                ? {
                                    prompt_tokens: json.usage.input_tokens,
                                    completion_tokens: json.usage.output_tokens,
                                    total_tokens: json.usage.total_tokens,
                                }
                                : undefined,
                        };
                    }
                }
                catch { }
                return this.mapResponsesToChat(json);
            }
            // Pre-send safety: gate tools and repair messages (non-streaming)
            const allowToolsNS = !!(request.tools && request.tools.length > 0) &&
                process.env["KAIDEX_DISABLE_TOOLS"] !== "1";
            // Estimate tools overhead: each tool definition ~500 tokens
            const toolsOverhead = allowToolsNS
                ? (request.tools?.length || 0) * 500
                : 0;
            const repairNS = preSendRepair(request.messages, allowToolsNS, this.maxInputTokens, toolsOverhead);
            const messagesToSendNS = repairNS.msgs;
            const requestBody = {
                messages: messagesToSendNS,
                stream: false,
            };
            // Only include model for cloud APIs (OpenAI/Claude)
            if (this.isCloudAPI) {
                requestBody.model = this.model;
                // OpenAI uses max_completion_tokens for newer models
                requestBody.max_completion_tokens = request.max_tokens;
                // OpenAI GPT-5 only supports temperature: 1 (default)
                // Don't send temperature parameter
            }
            else {
                // Local LLMs use max_tokens and support temperature
                requestBody.max_tokens = request.max_tokens;
                // Hardcoded 0.1 for consistent tool calling behavior
                requestBody.temperature = 0.1;
            }
            if (allowToolsNS && request.tools && request.tools.length > 0) {
                requestBody.tools = request.tools;
            }
            else {
                // Tools disabled or none present
            }
            const url = `${this.baseURL}${this.endpoint}`;
            // const response = await fetch(`${this.baseURL}/chat/completions`, {
            const response = await fetch(url, {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify(requestBody),
            });
            if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                const errorMsg = `KaiDex Server API error: ${response.status} ${response.statusText}. ${errorText}`;
                // Log to tmp for post-mortem
                logApiErrorToTmp("chatCompletion http-error", url, response.status, response.statusText, errorText, {
                    model: this.model,
                    endpoint: this.endpoint,
                    hasTools: !!requestBody.tools,
                    messages: requestBody.messages?.length,
                    maxTokens: requestBody.max_tokens ?? requestBody.max_completion_tokens,
                });
                // Parse error to detect recoverable issues
                let errorData = {};
                try {
                    errorData = JSON.parse(errorText);
                }
                catch { }
                const errorType = errorData?.error?.type;
                const errorCode = errorData?.error?.code;
                // Auto-retry on specific 400 errors with more aggressive repair
                if (response.status === 400 &&
                    errorType === "invalid_request_error" &&
                    (errorCode === "context_length_exceeded" ||
                        errorMsg.includes("tool_calls") ||
                        errorMsg.includes("expected a string, got null"))) {
                    console.log("⚠️  Recoverable API error detected, attempting auto-repair and retry...");
                    // More aggressive repair: disable tools and trim more aggressively
                    const hardLimit = this.maxInputTokens || 400000;
                    const aggressiveLimit = Math.floor(hardLimit * 0.5); // Use 50% for retry
                    const aggressiveRepair = preSendRepair(request.messages, false, aggressiveLimit, 0);
                    const finalMessages = aggressiveRepair.msgs;
                    const retryBody = {
                        ...requestBody,
                        messages: finalMessages,
                        tools: undefined,
                    };
                    const retryResponse = await fetch(url, {
                        method: "POST",
                        headers: this.headers,
                        body: JSON.stringify(retryBody),
                    });
                    if (!retryResponse.ok) {
                        const retryError = await retryResponse.text().catch(() => "");
                        logApiErrorToTmp("chatCompletion retry-http-error", url, retryResponse.status, retryResponse.statusText, retryError, {
                            model: this.model,
                            endpoint: this.endpoint,
                            hasTools: false,
                            messages: retryBody.messages?.length,
                            maxTokens: retryBody.max_tokens ?? retryBody.max_completion_tokens,
                        });
                        throw new Error(`KaiDex Server API error (after retry): ${retryResponse.status} ${retryResponse.statusText}. ${retryError}`);
                    }
                    const retryResult = await retryResponse.json();
                    return retryResult;
                }
                throw new Error(errorMsg);
            }
            const result = await response.json();
            return result;
        }
        catch (error) {
            console.error("KaiDex Server connection error:", error);
            throw error;
        }
    }
    /**
     * Primary OpenAI chat completion streaming method
     */
    async *chatCompletionStream(request, userPromptId) {
        try {
            const url = `${this.baseURL}${this.endpoint}`;
            // Early branch: handle non-chat (/completions) endpoints
            if (this.isCompletionsEndpoint()) {
                const reqBody = {
                    model: this.model,
                    prompt: this.linearizeMessages(request.messages),
                    max_tokens: request.max_tokens,
                    stream: false,
                };
                if (request.tools && request.tools.length > 0) {
                    console.warn("Tools are not supported on /completions. Ignoring tools.");
                }
                const resp = await fetch(url, {
                    method: "POST",
                    headers: this.headers,
                    body: JSON.stringify(reqBody),
                });
                if (!resp.ok) {
                    const errText = await resp.text().catch(() => "");
                    throw new Error("KaiDex Server API error: " +
                        resp.status +
                        " " +
                        resp.statusText +
                        ". " +
                        errText);
                }
                const json = await resp.json();
                const text = json && json.choices && json.choices[0] && json.choices[0].text
                    ? json.choices[0].text
                    : "";
                if (text) {
                    yield {
                        choices: [
                            { index: 0, delta: { content: text }, finish_reason: undefined },
                        ],
                    };
                }
                yield {
                    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
                };
                return;
            }
            // Early branch: handle OpenAI /responses endpoint by making a non-stream call and emitting one delta
            if (this.isResponsesEndpoint()) {
                const allowTools = !!(request.tools && request.tools.length > 0) &&
                    process.env["KAIDEX_DISABLE_TOOLS"] !== "1";
                // Convert OpenAI messages to /responses format
                const responsesInput = request.messages.flatMap((msg) => {
                    if (msg.role === "tool") {
                        // Convert tool result to function_call_output format
                        return [
                            {
                                type: "function_call_output",
                                call_id: msg.tool_call_id,
                                output: msg.content,
                            },
                        ];
                    }
                    else if (msg.role === "assistant" && msg.tool_calls) {
                        // Convert tool_calls to function_call objects for /responses
                        return msg.tool_calls.map((tc) => ({
                            type: "function_call",
                            call_id: tc.id,
                            name: tc.function.name,
                            arguments: tc.function.arguments,
                        }));
                    }
                    else {
                        // Regular user/assistant/system messages
                        return [
                            {
                                role: msg.role,
                                content: msg.content,
                            },
                        ];
                    }
                });
                const reqBody = {
                    model: this.model,
                    input: responsesInput,
                    max_output_tokens: request.max_tokens,
                    tool_choice: allowTools ? "auto" : "none",
                };
                if (allowTools && request.tools) {
                    // Convert from nested chat/completions format to flat responses format
                    reqBody.tools = request.tools.map((tool) => ({
                        type: tool.type,
                        name: tool.function.name,
                        description: tool.function.description,
                        parameters: tool.function.parameters,
                    }));
                }
                const resp = await fetch(url, {
                    method: "POST",
                    headers: this.headers,
                    body: JSON.stringify(reqBody),
                });
                if (!resp.ok) {
                    const errText = await resp.text().catch(() => "");
                    throw new Error("KaiDex Server API error: " +
                        resp.status +
                        " " +
                        resp.statusText +
                        ". " +
                        errText);
                }
                const json = await resp.json();
                // Check for function_call in the response
                let chat;
                try {
                    const output = Array.isArray(json?.output) ? json.output : [];
                    const functionCalls = [];
                    // /responses returns function_call directly in output array
                    for (const item of output) {
                        if (item?.type === "function_call") {
                            functionCalls.push(item);
                        }
                    }
                    if (functionCalls.length > 0) {
                        const toolCalls = functionCalls.map((fc) => ({
                            id: fc.call_id,
                            type: "function",
                            function: {
                                name: fc.name,
                                arguments: fc.arguments, // Already a JSON string
                            },
                        }));
                        chat = {
                            id: json?.id,
                            model: json?.model,
                            choices: [
                                {
                                    index: 0,
                                    message: {
                                        role: "assistant",
                                        content: "",
                                        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
                                    },
                                    finish_reason: "tool_calls",
                                },
                            ],
                            usage: json?.usage
                                ? {
                                    prompt_tokens: json.usage.input_tokens,
                                    completion_tokens: json.usage.output_tokens,
                                    total_tokens: json.usage.total_tokens,
                                }
                                : undefined,
                        };
                    }
                    else {
                        chat = this.mapResponsesToChat(json);
                    }
                }
                catch {
                    chat = this.mapResponsesToChat(json);
                }
                // Convert to Gemini format before yielding (cast to satisfy TypeScript, handled at line 1535)
                const geminiResponse = this.convertFromOpenAIResponse(chat);
                yield geminiResponse;
                return;
            }
            // Pre-send safety: gate tools and repair messages (streaming)
            const allowToolsS = !!(request.tools && request.tools.length > 0) &&
                process.env["KAIDEX_DISABLE_TOOLS"] !== "1";
            // Estimate tools overhead: each tool definition ~500 tokens
            const toolsOverheadS = allowToolsS
                ? (request.tools?.length || 0) * 500
                : 0;
            const repairS = preSendRepair(request.messages, allowToolsS, this.maxInputTokens, toolsOverheadS);
            const messagesToSendS = repairS.msgs;
            const requestBody = {
                messages: messagesToSendS,
                stream: false,
            };
            // Only include model for cloud APIs (OpenAI/Claude)
            if (this.isCloudAPI) {
                requestBody.model = this.model;
                // OpenAI uses max_completion_tokens for newer models
                requestBody.max_completion_tokens = request.max_tokens;
                // OpenAI GPT-5 only supports temperature: 1 (default)
                // Don't send temperature parameter
            }
            else {
                // Local LLMs use max_tokens and support temperature
                requestBody.max_tokens = request.max_tokens;
                // Hardcoded 0.1 for consistent tool calling behavior
                requestBody.temperature = 0.1;
            }
            if (allowToolsS && request.tools && request.tools.length > 0) {
                requestBody.tools = request.tools;
            }
            const bodyString = JSON.stringify(requestBody);
            let response;
            let fetchError = null;
            try {
                response = await fetch(url, {
                    method: "POST",
                    headers: this.headers,
                    body: bodyString,
                });
            }
            catch (err) {
                fetchError = err;
                // Log connection failure to tmp
                logApiErrorToTmp("chatCompletionStream fetch-error", url, -1, "FETCH_FAIL", err?.message || "fetch failed", {
                    model: this.model,
                    endpoint: this.endpoint,
                    hasTools: !!requestBody.tools,
                    messages: requestBody.messages?.length,
                    bodyBytes: bodyString.length,
                });
                // FALLBACK: If fetch failed and we sent tools, retry without tools field
                if (requestBody.tools && requestBody.tools.length > 0) {
                    const fb = preSendRepair(request.messages, false, this.maxInputTokens, 0);
                    const fallbackBody = {
                        messages: fb.msgs,
                        stream: false,
                    };
                    // Only include model for cloud APIs (OpenAI/Claude)
                    if (this.isCloudAPI) {
                        fallbackBody.model = this.model;
                        fallbackBody.max_completion_tokens = request.max_tokens;
                        // OpenAI GPT-5 only supports temperature: 1 (default)
                        // Don't send temperature parameter
                    }
                    else {
                        fallbackBody.max_tokens = request.max_tokens;
                        fallbackBody.temperature = request.temperature ?? 0.1;
                    }
                    const fallbackBodyString = JSON.stringify(fallbackBody);
                    try {
                        response = await fetch(url, {
                            method: "POST",
                            headers: this.headers,
                            body: fallbackBodyString,
                        });
                    }
                    catch (fallbackErr) {
                        throw new Error("Failed to connect to LLM server at " +
                            url +
                            ". " +
                            "Initial error: " +
                            fetchError.message +
                            ". " +
                            "Retry without tools also failed: " +
                            fallbackErr.message +
                            ". " +
                            "Check that the server is running.");
                    }
                }
                else {
                    // No tools were sent, so this is a fundamental connection issue
                    throw new Error("Failed to connect to LLM server at " +
                        url +
                        ". " +
                        "Error: " +
                        err.message +
                        ". " +
                        "Check that the server is running.");
                }
            }
            if (!response.ok) {
                const errorText = await response
                    .text()
                    .catch(() => "Unable to read error response");
                // Log HTTP error to tmp for post-mortem
                logApiErrorToTmp("chatCompletionStream http-error", url, response.status, response.statusText, errorText, {
                    model: this.model,
                    endpoint: this.endpoint,
                    hasTools: !!requestBody.tools,
                    messages: requestBody.messages?.length,
                    maxTokens: requestBody.max_tokens ?? requestBody.max_completion_tokens,
                });
                // Parse error to detect recoverable issues
                let errorData = {};
                try {
                    errorData = JSON.parse(errorText);
                }
                catch { }
                const errorType = errorData?.error?.type;
                const errorCode = errorData?.error?.code;
                const errorMsg = `KaiDex Server API error: ${response.status} ${response.statusText}. ${errorText}`;
                // Auto-retry on specific 400 errors with more aggressive repair (STREAMING)
                if (response.status === 400 &&
                    errorType === "invalid_request_error" &&
                    (errorCode === "context_length_exceeded" ||
                        errorMsg.includes("tool_calls") ||
                        errorMsg.includes("expected a string, got null"))) {
                    console.log("⚠️  Recoverable streaming API error detected, attempting auto-repair and retry...");
                    // More aggressive repair: disable tools and trim more aggressively
                    const hardLimit = this.maxInputTokens || 400000;
                    const aggressiveLimit = Math.floor(hardLimit * 0.5); // Use 50% for retry
                    const aggressiveRepair = preSendRepair(request.messages, false, aggressiveLimit, 0);
                    const finalMessages = aggressiveRepair.msgs;
                    const retryBody = {
                        messages: finalMessages,
                        stream: true,
                        tools: undefined,
                    };
                    if (this.isCloudAPI) {
                        retryBody.model = this.model;
                        retryBody.max_completion_tokens = request.max_tokens;
                    }
                    else {
                        retryBody.max_tokens = request.max_tokens;
                        retryBody.temperature = 0.1;
                    }
                    const retryResponse = await fetch(url, {
                        method: "POST",
                        headers: this.headers,
                        body: JSON.stringify(retryBody),
                    });
                    if (!retryResponse.ok) {
                        const retryError = await retryResponse.text().catch(() => "");
                        logApiErrorToTmp("chatCompletionStream retry-http-error", url, retryResponse.status, retryResponse.statusText, retryError, {
                            model: this.model,
                            endpoint: this.endpoint,
                            hasTools: false,
                            messages: retryBody.messages?.length,
                            maxTokens: retryBody.max_tokens ?? retryBody.max_completion_tokens,
                        });
                        throw new Error(`KaiDex Server API error (after streaming retry): ${retryResponse.status} ${retryResponse.statusText}. ${retryError}`);
                    }
                    // Replace response with retry response and continue
                    response = retryResponse;
                }
                else {
                    throw new Error(errorMsg);
                }
            }
            // Handle both streaming and non-streaming responses
            const responseText = await response.text();
            // Check if it's a complete JSON response (non-streaming)
            try {
                const jsonResponse = JSON.parse(responseText);
                // Convert complete response to streaming format
                if (jsonResponse.choices && jsonResponse.choices[0]?.message?.content) {
                    const content = jsonResponse.choices[0].message.content;
                    const toolCalls = jsonResponse.choices[0]?.message?.tool_calls || [];
                    // Process OpenAI format tool_calls array first
                    if (toolCalls.length > 0) {
                        const parsedToolCalls = toolCalls.map((tc) => {
                            const args = JSON.parse(tc.function.arguments || "{}");
                            // Coerce numeric strings to numbers (LLM sometimes returns "2000" instead of 2000)
                            for (const [key, value] of Object.entries(args)) {
                                if (typeof value === "string" && /^\d+$/.test(value)) {
                                    const num = Number(value);
                                    if (!isNaN(num)) {
                                        args[key] = num;
                                    }
                                }
                            }
                            return {
                                name: tc.function.name,
                                args: args,
                                id: tc.id,
                            };
                        });
                        const toolCallParts = parsedToolCalls.map((fc) => ({
                            functionCall: fc,
                        }));
                        yield {
                            candidates: [
                                {
                                    content: {
                                        parts: toolCallParts,
                                        role: "model",
                                    },
                                    finishReason: undefined,
                                },
                            ],
                            functionCalls: parsedToolCalls,
                            executableCode: null,
                            codeExecutionResult: null,
                        };
                        yield {
                            candidates: [
                                {
                                    content: {
                                        parts: [{ text: "" }],
                                        role: "model",
                                    },
                                    finishReason: "tool_calls",
                                },
                            ],
                            functionCalls: [],
                            executableCode: null,
                            codeExecutionResult: null,
                        };
                        return;
                    }
                    // Check for XML tool calls in content when tool_calls array is empty
                    if (content.includes("<function=")) {
                        const parsedToolCalls = this.parseXMLToolCalls(content);
                        if (parsedToolCalls.length > 0) {
                            // Convert tool calls to parts format for validation
                            const toolCallParts = parsedToolCalls.map((fc) => ({
                                functionCall: fc,
                            }));
                            // Convert to streaming format that turn.ts expects
                            yield {
                                candidates: [
                                    {
                                        content: {
                                            parts: toolCallParts, // Include tool call parts for validation
                                            role: "model",
                                        },
                                        finishReason: undefined,
                                    },
                                ],
                                functionCalls: parsedToolCalls,
                                executableCode: null,
                                codeExecutionResult: null,
                            };
                            // Yield finish marker for tool calls
                            yield {
                                candidates: [
                                    {
                                        content: {
                                            parts: [{ text: "" }], // Non-empty parts to pass validation
                                            role: "model",
                                        },
                                        finishReason: "tool_calls",
                                    },
                                ],
                                functionCalls: [],
                                executableCode: null,
                                codeExecutionResult: null,
                            };
                            return;
                        }
                    }
                    // Yield the content as a delta
                    yield {
                        choices: [
                            {
                                index: 0,
                                delta: { content: content },
                                finish_reason: undefined,
                            },
                        ],
                    };
                    // Yield finish marker
                    yield {
                        choices: [
                            {
                                index: 0,
                                delta: {},
                                finish_reason: "stop",
                            },
                        ],
                    };
                    return;
                }
                // Handle tool calls - Convert using convertFromOpenAIResponse
                if (jsonResponse.choices &&
                    jsonResponse.choices[0]?.message?.tool_calls) {
                    // Use the conversion function to properly format
                    const geminiResponse = this.convertFromOpenAIResponse(jsonResponse);
                    console.log(JSON.stringify(geminiResponse, null, 2));
                    // Yield the converted Gemini response as chunk
                    yield geminiResponse;
                    console.log();
                    return;
                }
                console.log();
            }
            catch (parseError) {
            }
            // If not JSON, process as streaming response
            const lines = responseText.split("\n");
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    if (line.includes("[DONE]")) {
                        yield {
                            choices: [
                                {
                                    index: 0,
                                    delta: {},
                                    finish_reason: "stop",
                                },
                            ],
                        };
                        return;
                    }
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.choices && data.choices.length > 0) {
                            yield data;
                        }
                    }
                    catch (e) {
                    }
                }
            }
        }
        catch (error) {
            console.error("🚨 FETCH FAILED SILENTLY - PROOF OF FAILURE:", error);
            console.error("🚨 Error type:", error?.constructor?.name);
            console.error("🚨 Error message:", error?.message);
            console.error("🚨 Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
            throw error;
        }
    }
    // ==================== GEMINI COMPATIBILITY INTERFACE (DEPRECATED) ====================
    /**
     * Convert Google Gemini Content format to OpenAI messages
     */
    convertToOpenAIMessages(contents) {
        const debugLog = (msg) => {
            if (!process.env["DEBUG_CHECKNEXTSPEAKER"])
                return;
            const fs = require("fs");
            if (!global.__kaidex_debug_log_file) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                global.__kaidex_debug_log_file =
                    `/tmp/kaidex_checknext_${timestamp}.log`;
            }
            fs.appendFileSync(global.__kaidex_debug_log_file, `${msg}\n`);
            console.log(msg);
        };
        const messages = [];
        debugLog(`convertToOpenAIMessages: INPUT contents count=${contents.length}`);
        debugLog(`convertToOpenAIMessages: INPUT contents=${JSON.stringify(contents, null, 2)}`);
        for (const content of contents) {
            debugLog(`Processing content: role=${content.role}, parts count=${content.parts?.length || 0}`);
            // Handle functionResponse parts (tool results)
            const functionResponseParts = content.parts?.filter((part) => "functionResponse" in part) || [];
            debugLog(`functionResponseParts.length=${functionResponseParts.length}`);
            if (functionResponseParts.length > 0) {
                debugLog(`BRANCH: functionResponse detected, count=${functionResponseParts.length}`);
                // For each tool result, create appropriate message format
                for (const part of functionResponseParts) {
                    const fr = part.functionResponse;
                    // Check for both success (output) and error (error) fields
                    const toolOutput = fr?.response?.output || fr?.response?.error || "";
                    const toolName = fr?.name || "unknown_tool";
                    const toolCallId = fr?.response?.id; // ID from tool execution
                    if (this.isCloudAPI && toolCallId) {
                        // OpenAI format: role: "tool" with tool_call_id - cap output to avoid blowouts
                        debugLog(`Converting functionResponse to OpenAI tool message, id=${toolCallId}`);
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCallId,
                            content: capToolOutput(toolOutput),
                        });
                    }
                    else {
                        // Local LLM format: use USER role to maintain alternation (avoid assistant→assistant)
                        const snippet = capToolOutput(toolOutput);
                        const toolResultMessage = `Tool '${toolName}' returned:\n${snippet}`;
                        debugLog(`Converting functionResponse to user message (local LLM), tool=${toolName}`);
                        messages.push({
                            role: "user",
                            content: toolResultMessage,
                        });
                    }
                }
                continue; // Skip to next content
            }
            // Handle functionCall parts (tool calls from LLM)
            const functionCallParts = content.parts?.filter((part) => "functionCall" in part) || [];
            if (functionCallParts.length > 0) {
                debugLog(`BRANCH: functionCall detected, count=${functionCallParts.length}`);
                // Detect if this came from XML parsing (Qwen3-style) vs native OpenAI format
                const isXMLBased = functionCallParts.some((part) => part.functionCall?.id?.startsWith("xml_"));
                if (isXMLBased) {
                    // Reconstruct XML format from functionCall object for MLX/Qwen3
                    debugLog(`Reconstructing XML format for Qwen3-style tool calls`);
                    const xmlContent = functionCallParts
                        .map((part) => {
                        const fc = part.functionCall;
                        const parameters = Object.entries(fc.args || {})
                            .map(([key, value]) => `<parameter=${key}>${value}</parameter>`)
                            .join("\n");
                        return `<function=${fc.name}>\n${parameters}\n</function>`;
                    })
                        .join("\n");
                    messages.push({
                        role: "assistant",
                        content: xmlContent,
                    });
                }
                else {
                    // Use OpenAI tool_calls structure for OpenAI-compatible servers
                    debugLog(`Using OpenAI tool_calls format`);
                    // Extract text content if any
                    const textParts = content.parts?.filter((part) => "text" in part) || [];
                    const text = textParts
                        .map((part) => ("text" in part ? part.text : ""))
                        .join("\n");
                    const tool_calls = functionCallParts.map((part, index) => {
                        const fc = part.functionCall;
                        return {
                            id: fc?.id || `call_${Date.now()}_${index}`,
                            type: "function",
                            function: {
                                name: fc?.name || "unknown",
                                arguments: JSON.stringify(fc?.args || {}),
                            },
                        };
                    });
                    messages.push({
                        role: "assistant",
                        content: (text && text.trim()) || "",
                        tool_calls: tool_calls,
                    });
                }
                continue;
            }
            // Handle regular text parts
            const textParts = content.parts?.filter((part) => "text" in part) || [];
            const text = textParts
                .map((part) => ("text" in part ? part.text : ""))
                .join("\n");
            debugLog(`textParts.length=${textParts.length}, text.length=${text.length}`);
            // Handle inlineData parts (images, PDFs, etc.)
            const inlineDataParts = content.parts?.filter((part) => "inlineData" in part) || [];
            // If we have images, use OpenAI's multimodal content format
            if (inlineDataParts.length > 0) {
                const role = content.role === "user"
                    ? "user"
                    : content.role === "model"
                        ? "assistant"
                        : "user";
                debugLog(`BRANCH: inlineData detected, role=${role}, count=${inlineDataParts.length}`);
                const contentArray = [];
                // Add text if exists
                if (text.trim()) {
                    contentArray.push({ type: "text", text: text.trim() });
                }
                // Add images in OpenAI format
                for (const part of inlineDataParts) {
                    const inline = part.inlineData;
                    const mimeType = inline.mimeType || "image/png";
                    const base64Data = inline.data;
                    debugLog(`Converting inlineData to image_url: mimeType=${mimeType}, dataLength=${base64Data?.length || 0}`);
                    contentArray.push({
                        type: "image_url",
                        image_url: {
                            url: `data:${mimeType};base64,${base64Data}`,
                        },
                    });
                }
                // For multimodal content (images), cast to any since OpenAI accepts content as array
                messages.push({
                    role: role,
                    content: contentArray,
                });
            }
            else if (text.trim()) {
                // Text only, no images
                const role = content.role === "user"
                    ? "user"
                    : content.role === "model"
                        ? "assistant"
                        : "user";
                debugLog(`BRANCH: text detected, role=${role}, length=${text.length}`);
                messages.push({
                    role: role,
                    content: text.trim(),
                });
            }
            else {
            }
        }
        console.log(contents.length, "contents to", messages.length, "OpenAI messages");
        debugLog(`convertToOpenAIMessages: OUTPUT messages=${JSON.stringify(messages, null, 2)}`);
        return messages;
    }
    /**
     * Parse XML format tool calls from content field
     * Format: <function=read_file><parameter=absolute_path>/path</parameter></function>
     */
    parseXMLToolCalls(content) {
        console.log(`parseXMLToolCalls: parsing content of length ${content.length}`);
        console.log(`parseXMLToolCalls: first 1000 chars:`, content.substring(0, 1000));
        const functionCalls = [];
        // Match XML function calls - handles both formats:
        // <function=name><parameter=param>value</parameter></function>
        // <function=name><parameter=param>value</parameter></function></tool_call>
        const functionRegex = /<function=([^>]+)>(.*?)<\/function>(?:<\/tool_call>)?/gs;
        let match;
        let matchCount = 0;
        while ((match = functionRegex.exec(content)) !== null) {
            matchCount++;
            const functionName = match[1];
            const parametersXML = match[2];
            console.log(`parseXMLToolCalls: found function ${functionName} with parameters:`, parametersXML);
            // Parse parameters from XML
            const args = {};
            const paramRegex = /<parameter=([^>]+)>(.*?)<\/parameter>/gs;
            let paramMatch;
            while ((paramMatch = paramRegex.exec(parametersXML)) !== null) {
                const paramName = paramMatch[1];
                let paramValue = paramMatch[2].trim();
                // Fix parameter mapping for read_file tool
                const actualParamName = functionName === "read_file" && paramName === "path"
                    ? "absolute_path"
                    : paramName;
                // Coerce numeric strings to numbers (XML always extracts as strings)
                if (/^\d+$/.test(paramValue)) {
                    paramValue = Number(paramValue);
                    console.log(`parseXMLToolCalls: coerced numeric param ${actualParamName} to ${paramValue}`);
                }
                args[actualParamName] = paramValue;
            }
            const toolCall = {
                name: functionName,
                args: args,
                id: `xml_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            };
            console.log(`parseXMLToolCalls: created toolCall:`, JSON.stringify(toolCall, null, 2));
            functionCalls.push(toolCall);
        }
        return functionCalls;
    }
    /**
     * Estimate token count from text (rough approximation: 1 token ≈ 4 characters)
     * Used for local LLMs that don't return usage metadata
     */
    estimateTokenCount(text) {
        if (!text)
            return 0;
        // Rough estimation: 1 token per 4 characters (average for English)
        // This matches GPT tokenizer behavior reasonably well
        return Math.ceil(text.length / 4);
    }
    // Detect if the configured endpoint is the legacy completions API (not chat)
    isCompletionsEndpoint() {
        const ep = this.endpoint || "";
        return (ep.indexOf("/completions") !== -1 &&
            ep.indexOf("/chat/completions") === -1);
    }
    // Detect if the configured endpoint is the OpenAI Responses API
    isResponsesEndpoint() {
        const ep = this.endpoint || "";
        return ep.indexOf("/responses") !== -1;
    }
    // Convert chat messages to a single prompt string for /completions
    linearizeMessages(messages) {
        const mapRole = (r) => r === "assistant" ? "assistant" : r === "system" ? "system" : "user";
        const lines = messages.map((m) => mapRole(m.role) +
            ": " +
            (typeof m.content === "string" ? m.content : ""));
        lines.push("assistant:");
        return lines.join("\n");
    }
    // Map /completions response back to ChatCompletionResponse shape
    mapCompletionsToChat(resp) {
        const text = resp && resp.choices && resp.choices[0] && resp.choices[0].text
            ? resp.choices[0].text
            : "";
        return {
            id: resp && resp.id,
            model: resp && resp.model,
            choices: [
                {
                    index: 0,
                    message: { role: "assistant", content: text },
                    finish_reason: resp &&
                        resp.choices &&
                        resp.choices[0] &&
                        resp.choices[0].finish_reason,
                },
            ],
            usage: resp && resp.usage
                ? {
                    prompt_tokens: resp.usage.prompt_tokens,
                    completion_tokens: resp.usage.completion_tokens,
                    total_tokens: resp.usage.total_tokens,
                }
                : undefined,
        };
    }
    // Map OpenAI Responses API response back to ChatCompletionResponse shape
    mapResponsesToChat(resp) {
        // Prefer output_text if present, otherwise extract from nested output structure
        const direct = resp?.output_text;
        let text = typeof direct === "string" ? direct : "";
        if (!text && Array.isArray(resp?.output)) {
            // output[] contains items like { type: "message", content: [{type: "output_text", text: "..."}] }
            for (const item of resp.output) {
                if (item?.type === "message" && Array.isArray(item?.content)) {
                    for (const contentItem of item.content) {
                        if (contentItem?.type === "output_text" &&
                            typeof contentItem?.text === "string") {
                            text += contentItem.text;
                        }
                    }
                }
            }
        }
        return {
            id: resp?.id,
            model: resp?.model,
            choices: [
                {
                    index: 0,
                    message: { role: "assistant", content: text || "" },
                    finish_reason: "stop",
                },
            ],
            usage: resp?.usage
                ? {
                    prompt_tokens: resp.usage.input_tokens,
                    completion_tokens: resp.usage.output_tokens,
                    total_tokens: resp.usage.total_tokens,
                }
                : undefined,
        };
    }
    /**
     * Convert OpenAI response back to Google Gemini format
     */
    convertFromOpenAIResponse(openaiResponse) {
        const debugLog = (msg) => {
            if (!process.env["DEBUG_CHECKNEXTSPEAKER"])
                return;
            const fs = require("fs");
            if (!global.__kaidex_debug_log_file) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                global.__kaidex_debug_log_file =
                    `/tmp/kaidex_checknext_${timestamp}.log`;
            }
            fs.appendFileSync(global.__kaidex_debug_log_file, `${msg}\n`);
            console.log(msg);
        };
        // Remove logprobs from logging to prevent Claude crash when analyzing logs
        const { choices, ...responseWithoutChoices } = openaiResponse;
        const safeChoices = choices?.map((choice) => {
            const { logprobs, ...safeChoice } = choice;
            return safeChoice;
        });
        console.log(JSON.stringify({ ...responseWithoutChoices, choices: safeChoices }, null, 2));
        const choice = openaiResponse.choices?.[0];
        const content = choice?.message?.content || "";
        const toolCalls = choice?.message?.tool_calls || [];
        console.log(content?.length, "chars:", content?.slice(0, 100));
        // DEBUG: Log full content if it contains XML tool calls
        if (content.includes("<function=")) {
            debugLog(`Content contains XML tool calls: ${content.slice(0, 200)}`);
        }
        // Convert OpenAI tool_calls to Gemini functionCalls format
        let functionCalls = toolCalls.map((toolCall) => {
            const args = JSON.parse(toolCall.function.arguments || "{}");
            // Coerce numeric strings to numbers (LLM sometimes returns "2000" instead of 2000)
            for (const [key, value] of Object.entries(args)) {
                if (typeof value === "string" && /^\d+$/.test(value)) {
                    const num = Number(value);
                    if (!isNaN(num)) {
                        args[key] = num;
                    }
                }
            }
            return {
                name: toolCall.function.name,
                args: args,
                id: toolCall.id,
            };
        });
        // If no tool_calls found but content contains XML format tool calls, parse them
        if (functionCalls.length === 0 && content.includes("<function=")) {
            debugLog(`No JSON tool_calls but content contains XML format tool calls`);
            functionCalls = this.parseXMLToolCalls(content);
            debugLog(`Parsed ${functionCalls.length} XML tool calls`);
        }
        console.log(functionCalls.length, "function calls");
        // If we have function calls (either JSON or parsed XML), show them instead of raw content
        const parts = functionCalls.length > 0
            ? functionCalls.map((fc) => ({ functionCall: fc }))
            : content
                ? [{ text: content }]
                : [];
        const candidateStructure = {
            content: {
                parts: parts,
                role: "model",
            },
            finishReason: (choice?.finish_reason || "STOP").toUpperCase(),
        };
        // Client-side token counting for local LLMs that don't return usage metadata
        let usageMetadata;
        // Debug: log raw provider usage if present
        debugLog(`TOKEN_TELEMETRY_INPUT: openaiResponse.usage=${JSON.stringify(openaiResponse.usage || null)}`);
        if (openaiResponse.usage) {
            // Use server-provided usage if available (OpenAI, Gemini, etc.)
            usageMetadata = {
                promptTokenCount: openaiResponse.usage.prompt_tokens || 0,
                candidatesTokenCount: openaiResponse.usage.completion_tokens || 0,
                totalTokenCount: openaiResponse.usage.total_tokens || 0,
            };
            debugLog(`[${new Date().toISOString()}] SERVER usage: prompt=${usageMetadata.promptTokenCount}, response=${usageMetadata.candidatesTokenCount}`);
            // Explicit mapping log for grepability
        }
        else {
            // Estimate tokens client-side for local LLMs (MLX, Ollama, etc.)
            debugLog(`TOKEN_TELEMETRY_INPUT: provider usage missing - will run client-side estimation`);
            const responseTokens = this.estimateTokenCount(content);
            // Get prompt tokens from the stored request context if available
            const promptTokens = this._lastRequestTokenCount || 0;
            usageMetadata = {
                promptTokenCount: promptTokens,
                candidatesTokenCount: responseTokens,
                totalTokenCount: promptTokens + responseTokens,
            };
            debugLog(`[${new Date().toISOString()}] CLIENT-SIDE token estimation: prompt=${promptTokens}, response=${responseTokens}, total=${promptTokens + responseTokens}`);
            debugLog(`RESPONSE USAGE METADATA (ESTIMATE): ${JSON.stringify(usageMetadata)}`);
        }
        const geminiResponse = {
            response: {
                candidates: [candidateStructure],
            },
            candidates: [candidateStructure],
            text: () => content,
            data: openaiResponse,
            functionCalls: functionCalls,
            executableCode: null,
            codeExecutionResult: null,
            usageMetadata: usageMetadata,
        };
        console.log(geminiResponse.candidates?.length, "functionCalls:", geminiResponse.functionCalls?.length);
        return geminiResponse;
    }
    async generateContent(request, userPromptId) {
        try {
            const messages = this.convertToOpenAIMessages(request.contents);
            // Handle JSON schema requests for local LLM compatibility
            if (request.config?.responseMimeType === "application/json") {
                const schema = request.config.responseJsonSchema || request.config.responseSchema;
                if (schema) {
                    const lastMessage = messages[messages.length - 1];
                    if (lastMessage && lastMessage.role === "user") {
                        const jsonInstruction = `\n\nIMPORTANT: Respond with valid JSON only in this exact format:\n${JSON.stringify(schema, null, 2)}`;
                        lastMessage.content += jsonInstruction;
                        console.log(lastMessage.content.length);
                    }
                }
            }
            // Use the primary OpenAI interface
            const openaiRequest = {
                model: this.model,
                messages: messages,
                temperature: request.config?.temperature ?? 0.1,
                max_tokens: request.config?.maxOutputTokens ?? this.maxOutputTokens,
                stream: true,
            };
            const debugLog = (msg) => {
                if (!process.env["DEBUG_CHECKNEXTSPEAKER"])
                    return;
                const fs = require("fs");
                if (!global.__kaidex_debug_log_file) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                    global.__kaidex_debug_log_file =
                        `/tmp/kaidex_checknext_${timestamp}.log`;
                }
                fs.appendFileSync(global.__kaidex_debug_log_file, `${msg}\n`);
                console.log(msg);
            };
            // Estimate input tokens for client-side counting (used when LLM doesn't return usage)
            const inputText = messages
                .map((m) => (typeof m.content === "string" ? m.content : ""))
                .join(" ");
            this._lastRequestTokenCount = this.estimateTokenCount(inputText);
            const requestTimestamp = new Date().toISOString();
            debugLog(`generateContent request at ${requestTimestamp}`);
            const openaiResponse = await this.chatCompletion(openaiRequest, userPromptId);
            debugLog(`generateContent response received, content length: ${openaiResponse.choices?.[0]?.message?.content?.length || 0}`);
            const geminiResponse = this.convertFromOpenAIResponse(openaiResponse);
            debugLog(`convertFromOpenAIResponse candidates: ${geminiResponse.candidates?.length || 0}`);
            return geminiResponse;
        }
        catch (error) {
            console.error("Gemini compatibility generateContent error:", error);
            throw error;
        }
    }
    async *generateContentStream(request, userPromptId) {
        console.log(request.config?.tools?.length || 0);
        try {
            const messages = this.convertToOpenAIMessages(request.contents);
            // Convert Gemini tools to OpenAI function calling format
            const tools = this.convertToOpenAITools(request.config?.tools);
            console.log(tools?.length || 0, "tools for OpenAI");
            // Use the primary OpenAI interface
            const openaiRequest = {
                model: this.model,
                messages: messages,
                temperature: request.config?.temperature ?? 0.1,
                max_tokens: request.config?.maxOutputTokens ?? this.maxOutputTokens,
                stream: true,
                ...(tools && tools.length > 0 ? { tools } : {}),
            };
            console.log(JSON.stringify(openaiRequest, null, 2));
            // Estimate input tokens for client-side counting (used when LLM doesn't return usage)
            const inputText = messages
                .map((m) => (typeof m.content === "string" ? m.content : ""))
                .join(" ");
            this._lastRequestTokenCount = this.estimateTokenCount(inputText);
            this._streamAccumulatedText = ""; // Reset for this stream
            const streamGenerator = this.chatCompletionStream(openaiRequest, userPromptId);
            for await (const openaiResponse of streamGenerator) {
                // Check if this is already a converted Gemini response
                if (openaiResponse.candidates &&
                    openaiResponse.functionCalls !== undefined) {
                    yield openaiResponse;
                }
                const delta = openaiResponse.choices?.[0]?.delta?.content ||
                    openaiResponse.choices?.[0]?.message?.content ||
                    "";
                const finishReason = openaiResponse.choices?.[0]?.finish_reason;
                console.log(delta, "finishReason:", finishReason);
                // Extract tool_calls from OpenAI response
                const tool_calls = openaiResponse.choices?.[0]?.message?.tool_calls ||
                    openaiResponse.choices?.[0]?.delta?.tool_calls ||
                    [];
                // Accumulate text for client-side token counting
                if (delta) {
                    this._streamAccumulatedText += delta;
                }
                if (delta || tool_calls.length > 0) {
                    // Convert tool_calls to Gemini functionCalls format
                    const functionCalls = tool_calls.map((tc) => {
                        let args = {};
                        try {
                            args = tc.function?.arguments
                                ? JSON.parse(tc.function.arguments)
                                : tc.arguments || {};
                        }
                        catch (e) {
                            console.error("Failed to parse tool call arguments:", tc.function?.arguments);
                            args = {};
                        }
                        return {
                            name: tc.function?.name || tc.name,
                            args: args,
                        };
                    });
                    const geminiResponse = {
                        response: {
                            candidates: [
                                {
                                    content: {
                                        parts: delta ? [{ text: delta }] : [],
                                        role: "model",
                                    },
                                    finishReason: "",
                                },
                            ],
                        },
                        candidates: [
                            {
                                content: {
                                    parts: delta ? [{ text: delta }] : [],
                                    role: "model",
                                },
                                finishReason: "",
                            },
                        ],
                        text: () => delta || "",
                        data: openaiResponse,
                        functionCalls: functionCalls,
                        executableCode: null,
                        codeExecutionResult: null,
                    };
                    yield geminiResponse;
                }
                // Handle finish reason separately
                if (finishReason) {
                    // Client-side token counting for final chunk
                    const accumulatedText = this._streamAccumulatedText || "";
                    const responseTokens = this.estimateTokenCount(accumulatedText);
                    const promptTokens = this._lastRequestTokenCount || 0;
                    const usageMetadata = openaiResponse.usage
                        ? {
                            promptTokenCount: openaiResponse.usage.prompt_tokens || 0,
                            candidatesTokenCount: openaiResponse.usage.completion_tokens || 0,
                            totalTokenCount: openaiResponse.usage.total_tokens || 0,
                        }
                        : {
                            promptTokenCount: promptTokens,
                            candidatesTokenCount: responseTokens,
                            totalTokenCount: promptTokens + responseTokens,
                        };
                    // Extract tool_calls for finish chunk (tool_calls usually come in final message)
                    const finishToolCalls = openaiResponse.choices?.[0]?.message?.tool_calls || [];
                    const finishFunctionCalls = finishToolCalls.map((tc) => {
                        let args = {};
                        try {
                            args = tc.function?.arguments
                                ? JSON.parse(tc.function.arguments)
                                : tc.arguments || {};
                        }
                        catch (e) {
                            console.error("Failed to parse finish tool call arguments:", tc.function?.arguments);
                            args = {};
                        }
                        return {
                            name: tc.function?.name || tc.name,
                            args: args,
                        };
                    });
                    const finishResponse = {
                        response: {
                            candidates: [
                                {
                                    content: {
                                        parts: [],
                                        role: "model",
                                    },
                                    finishReason: finishReason === "stop" ? "STOP" : finishReason,
                                },
                            ],
                        },
                        candidates: [
                            {
                                content: {
                                    parts: [],
                                    role: "model",
                                },
                                finishReason: finishReason === "stop" ? "STOP" : finishReason,
                            },
                        ],
                        text: () => "",
                        data: openaiResponse,
                        functionCalls: finishFunctionCalls,
                        executableCode: null,
                        codeExecutionResult: null,
                        usageMetadata: usageMetadata,
                    };
                    yield finishResponse;
                }
            }
        }
        catch (error) {
            console.error("Gemini compatibility generateContentStream error:", error);
            throw error;
        }
    }
    async countTokens(request) {
        // Simple token estimation for local models
        const text = (request.contents || [])
            .map((c) => (c.parts || []).map((p) => p.text || "").join(" "))
            .join(" ");
        const tokenCount = Math.ceil(text.length / 4); // Rough estimate: ~4 chars per token
        return { totalTokens: tokenCount };
    }
    async embedContent(request) {
        // For now, return a dummy embedding - can be enhanced later
        const embedding = new Array(1536).fill(0).map(() => Math.random() - 0.5);
        return { embeddings: embedding };
    }
    /**
     * Convert Gemini tools to OpenAI function calling format
     */
    convertToOpenAITools(geminiTools) {
        if (!geminiTools || geminiTools.length === 0) {
            return undefined;
        }
        const openaiTools = [];
        for (const tool of geminiTools) {
            if (tool.functionDeclarations) {
                for (const func of tool.functionDeclarations) {
                    openaiTools.push({
                        type: "function",
                        function: {
                            name: func.name,
                            description: func.description,
                            parameters: func.parametersJsonSchema || func.parameters,
                        },
                    });
                }
            }
        }
        return openaiTools.length > 0 ? openaiTools : undefined;
    }
}
/**
 * Creates content generator instances based on configuration
 */
export async function createContentGenerator(configOrContentGeneratorConfig, config, sessionId) {
    // ALWAYS use local LLM - stub out all Google paths
    let actualConfig;
    if ("getModel" in configOrContentGeneratorConfig) {
        actualConfig = configOrContentGeneratorConfig;
    }
    else {
        actualConfig = config;
    }
    // Load LLM provider config from environment using llmProviderLoader
    const { loadProviderConfig } = await import("../config/llmProviderLoader.js");
    const providerConfig = loadProviderConfig();
    // Start MLX supervisor if using local-mlx provider
    const provider = process.env["LLM_PROVIDER"] || "local-mlx";
    if (provider === "local-mlx") {
        await ensureMlxSupervisor(providerConfig.baseURL);
    }
    // Use MODEL env var, or provider's defaultModel, or config's model
    const selectedModel = process.env["MODEL"] ||
        providerConfig.defaultModel ||
        actualConfig.getModel();
    console.log(`📡 Using LLM provider: ${providerConfig.name}`);
    console.log(`📡 Endpoint: ${providerConfig.baseURL}${providerConfig.endpoint}`);
    console.log(`📡 Model: ${selectedModel}`);
    if (providerConfig.maxInputTokens) {
        console.log(`📊 Context limit: ${providerConfig.maxInputTokens.toLocaleString()} input tokens, ${providerConfig.maxOutputTokens?.toLocaleString() || "unlimited"} output tokens`);
    }
    const generator = new LocalLLMContentGenerator({
        authType: AuthType.LOCAL_LLM,
        baseURL: providerConfig.baseURL,
        endpoint: providerConfig.endpoint,
        apiKey: "local-llm",
        model: selectedModel,
        userTier: undefined,
        headers: providerConfig.headers,
        maxInputTokens: providerConfig.maxInputTokens,
        maxOutputTokens: providerConfig.maxOutputTokens,
    });
    // ALWAYS wrap with logging for UI token display (even if OpenTelemetry is disabled)
    // The LoggingContentGenerator feeds uiTelemetryService which powers the context display
    return Promise.resolve(new LoggingContentGenerator(generator, actualConfig));
}
/**
 * Helper to get content generator or fail
 */
export async function getContentGeneratorOrFail(config) {
    try {
        return await createContentGenerator(config);
    }
    catch (error) {
        console.error("Failed to create content generator:", error);
        throw new Error(`Content generator initialization failed: ${error}`);
    }
}
/**
 * Create content generator configuration
 */
export function createContentGeneratorConfig(config, authMethod) {
    return {
        authType: AuthType.LOCAL_LLM,
        baseURL: "http://localhost:11453/v1",
        apiKey: "local-llm",
        model: "kaidex-server",
    };
}
export { InstallationManager };
//# sourceMappingURL=contentGenerator.js.map