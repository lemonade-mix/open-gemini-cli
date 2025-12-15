/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { type PartListUnion } from "@google/genai";
import type { UseHistoryManagerReturn } from "./useHistoryManager.js";
import type { Config } from "@google/kaidex-cli-core";
import { ToolConfirmationOutcome } from "@google/kaidex-cli-core";
import type { HistoryItemWithoutId, SlashCommandProcessorResult, HistoryItem } from "../types.js";
import type { LoadedSettings } from "../../config/settings.js";
import { type CommandContext, type SlashCommand } from "../commands/types.js";
interface SlashCommandProcessorActions {
    openAuthDialog: () => void;
    openThemeDialog: () => void;
    openEditorDialog: () => void;
    openPrivacyNotice: () => void;
    openSettingsDialog: () => void;
    quit: (messages: HistoryItem[]) => void;
    setDebugMessage: (message: string) => void;
    toggleCorgiMode: () => void;
}
/**
 * Hook to define and process slash commands (e.g., /help, /clear).
 */
export declare const useSlashCommandProcessor: (config: Config | null, settings: LoadedSettings, addItem: UseHistoryManagerReturn["addItem"], clearItems: UseHistoryManagerReturn["clearItems"], loadHistory: UseHistoryManagerReturn["loadHistory"], refreshStatic: () => void, toggleVimEnabled: () => Promise<boolean>, setIsProcessing: (isProcessing: boolean) => void, setGeminiMdFileCount: (count: number) => void, actions: SlashCommandProcessorActions) => {
    handleSlashCommand: (rawQuery: PartListUnion, oneTimeShellAllowlist?: Set<string>, overwriteConfirmed?: boolean) => Promise<SlashCommandProcessorResult | false>;
    slashCommands: readonly SlashCommand[];
    pendingHistoryItems: HistoryItemWithoutId[];
    commandContext: CommandContext;
    shellConfirmationRequest: {
        commands: string[];
        onConfirm: (outcome: ToolConfirmationOutcome, approvedCommands?: string[]) => void;
    } | null;
    confirmationRequest: {
        prompt: React.ReactNode;
        onConfirm: (confirmed: boolean) => void;
    } | null;
};
export {};
