/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { executeToolCall, shutdownTelemetry, isTelemetrySdkInitialized, KaiDexEventType, parseAndFormatApiError, FatalInputError, FatalTurnLimitedError, } from "@google/kaidex-cli-core";
import { ConsolePatcher } from "./ui/utils/ConsolePatcher.js";
import { handleAtCommand } from "./ui/hooks/atCommandProcessor.js";
export async function runNonInteractive(config, input, prompt_id) {
    const consolePatcher = new ConsolePatcher({
        stderr: true,
        debugMode: config.getDebugMode(),
    });
    try {
        consolePatcher.patch();
        process.stdout.on("error", (err) => {
            if (err.code === "EPIPE") {
                process.exit(0);
            }
        });
        const geminiClient = config.getKaiDexClient();
        const abortController = new AbortController();
        const { processedQuery, shouldProceed } = await handleAtCommand({
            query: input,
            config,
            addItem: (_item, _timestamp) => 0,
            onDebugMessage: () => { },
            messageId: Date.now(),
            signal: abortController.signal,
        });
        if (!shouldProceed || !processedQuery) {
            throw new FatalInputError("Exiting due to an error processing the @ command.");
        }
        let currentMessages = [
            { role: "user", parts: processedQuery },
        ];
        let turnCount = 0;
        while (true) {
            turnCount++;
            if (config.getMaxSessionTurns() >= 0 &&
                turnCount > config.getMaxSessionTurns()) {
                throw new FatalTurnLimitedError("Reached max session turns for this session. Increase the number of turns by specifying maxSessionTurns in settings.json.");
            }
            const toolCallRequests = [];
            const responseStream = geminiClient.sendMessageStream(currentMessages[0]?.parts || [], abortController.signal, prompt_id);
            for await (const event of responseStream) {
                if (abortController.signal.aborted) {
                    console.error("Operation cancelled.");
                    return;
                }
                if (event.type === KaiDexEventType.Content) {
                    process.stdout.write(event.value);
                }
                else if (event.type === KaiDexEventType.ToolCallRequest) {
                    toolCallRequests.push(event.value);
                }
            }
            if (toolCallRequests.length > 0) {
                const toolResponseParts = [];
                for (const requestInfo of toolCallRequests) {
                    const toolResponse = await executeToolCall(config, requestInfo, abortController.signal);
                    if (toolResponse.error) {
                        console.error(`Error executing tool ${requestInfo.name}: ${toolResponse.resultDisplay || toolResponse.error.message}`);
                    }
                    if (toolResponse.responseParts) {
                        toolResponseParts.push(...toolResponse.responseParts);
                    }
                }
                currentMessages = [{ role: "user", parts: toolResponseParts }];
            }
            else {
                process.stdout.write("\n");
                return;
            }
        }
    }
    catch (error) {
        console.error(parseAndFormatApiError(error, config.getContentGeneratorConfig()?.authType));
        throw error;
    }
    finally {
        consolePatcher.cleanup();
        if (isTelemetrySdkInitialized()) {
            await shutdownTelemetry(config);
        }
    }
}
//# sourceMappingURL=nonInteractiveCli.js.map