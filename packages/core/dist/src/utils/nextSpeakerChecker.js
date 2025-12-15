/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { DEFAULT_KAIDEX_FLASH_MODEL } from "../config/models.js";
import { isFunctionResponse } from "./messageInspectors.js";
import { googleContentArrayToKaidex } from "./typeAdapters.js";
const CHECK_PROMPT = `Analyze *only* the content and structure of your immediately preceding response (your last turn in the conversation history). Based *strictly* on that response, determine who should logically speak next: the 'user' or the 'model' (you).

**Decision Rules (apply in order):**
1.  **Model Continues:** If your last response explicitly states an immediate next action *you* intend to take (e.g., "Next, I will...", "Now I'll process...", "Moving on to analyze...", indicates an intended tool call that didn't execute), OR if the response seems clearly incomplete (cut off mid-thought without a natural conclusion), then the **'model'** should speak next.
2.  **Question to User:** If your last response ends with a direct question specifically addressed *to the user*, then the **'user'** should speak next.
3.  **Waiting for User:** If your last response completed a thought, statement, or task *and* does not meet the criteria for Rule 1 (Model Continues) or Rule 2 (Question to User), it implies a pause expecting user input or reaction. In this case, the **'user'** should speak next.

**Reply with ONLY one word - either "user" or "model" - nothing else.**`;
export async function checkNextSpeaker(chat, geminiClient, abortSignal) {
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
    debugLog(`checkNextSpeaker called`);
    // We need to capture the curated history because there are many moments when the model will return invalid turns
    // that when passed back up to the endpoint will break subsequent calls. An example of this is when the model decides
    // to respond with an empty part collection if you were to send that message back to the server it will respond with
    // a 400 indicating that model part collections MUST have content.
    const curatedHistory = chat.getHistory(/* curated */ true);
    // Ensure there's a model response to analyze
    if (curatedHistory.length === 0) {
        console.log(`curatedHistory is empty, returning null`);
        // Cannot determine next speaker if history is empty.
        return null;
    }
    const comprehensiveHistory = chat.getHistory();
    // If comprehensiveHistory is empty, there is no last message to check.
    // This case should ideally be caught by the curatedHistory.length check earlier,
    // but as a safeguard:
    if (comprehensiveHistory.length === 0) {
        console.log(`comprehensiveHistory is empty, returning null`);
        return null;
    }
    const lastComprehensiveMessage = comprehensiveHistory[comprehensiveHistory.length - 1];
    console.log(`lastComprehensiveMessage role: ${lastComprehensiveMessage?.role}`);
    // If the last message is a user message containing only function_responses,
    // then the model should speak next.
    if (lastComprehensiveMessage &&
        isFunctionResponse(lastComprehensiveMessage)) {
        debugLog(`Last message is function response, model should speak next`);
        return {
            reasoning: "The last message was a function response, so the model should speak next.",
            next_speaker: "model",
        };
    }
    if (lastComprehensiveMessage &&
        lastComprehensiveMessage.role === "model" &&
        lastComprehensiveMessage.parts &&
        lastComprehensiveMessage.parts.length === 0) {
        console.log(`Last model message has empty parts, model should speak next`);
        lastComprehensiveMessage.parts.push({ text: "" });
        return {
            reasoning: "The last message was a filler model message with no content (nothing for user to act on), model should speak next.",
            next_speaker: "model",
        };
    }
    // Things checked out. Let's proceed to potentially making an LLM request.
    const lastMessage = curatedHistory[curatedHistory.length - 1];
    if (!lastMessage || lastMessage.role !== "model") {
        console.log(`Last message not from model, returning null`);
        // Cannot determine next speaker if the last turn wasn't from the model
        // or if history is empty.
        return null;
    }
    const contents = [
        ...curatedHistory,
        { role: "user", parts: [{ text: CHECK_PROMPT }] },
    ];
    debugLog(`Preparing to check next speaker with ${contents.length} messages`);
    const kaidexContents = googleContentArrayToKaidex(contents);
    debugLog(`Converted to kaidex format`);
    try {
        const response = await geminiClient.generateContent(kaidexContents, {}, // empty config - plain text response
        abortSignal, DEFAULT_KAIDEX_FLASH_MODEL);
        // Extract text from response
        const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
        debugLog(`Response text: ${responseText}`);
        // Parse plain text response - extract "user" or "model"
        const normalizedText = responseText.trim().toLowerCase();
        let nextSpeaker = null;
        if (normalizedText === "user" || normalizedText === '"user"') {
            nextSpeaker = "user";
        }
        else if (normalizedText === "model" || normalizedText === '"model"') {
            nextSpeaker = "model";
        }
        else if (normalizedText.includes("user")) {
            // Fallback: if response contains "user" assume user
            nextSpeaker = "user";
        }
        else if (normalizedText.includes("model")) {
            // Fallback: if response contains "model" assume model
            nextSpeaker = "model";
        }
        if (nextSpeaker) {
            const result = {
                reasoning: `Plain text response indicated: ${nextSpeaker}`,
                next_speaker: nextSpeaker,
            };
            debugLog(`Next speaker determined: ${nextSpeaker}`);
            return result;
        }
        debugLog(`Could not determine next speaker from response`);
        return null;
    }
    catch (error) {
        console.log(`Error checking next speaker: ${error}`);
        console.warn("Failed to talk to KaiDex endpoint when seeing if conversation should continue.", error);
        return null;
    }
}
//# sourceMappingURL=nextSpeakerChecker.js.map