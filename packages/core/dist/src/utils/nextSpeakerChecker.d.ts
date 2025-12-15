/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { KaiDexClient } from "../core/client.js";
import type { KaiDexChat } from "../core/kaidexChat.js";
export interface NextSpeakerResponse {
    reasoning: string;
    next_speaker: "user" | "model";
}
export declare function checkNextSpeaker(chat: KaiDexChat, geminiClient: KaiDexClient, abortSignal: AbortSignal): Promise<NextSpeakerResponse | null>;
