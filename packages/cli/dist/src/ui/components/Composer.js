import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { Box, Text } from "ink";
import { LoadingIndicator } from "./LoadingIndicator.js";
import { ContextSummaryDisplay } from "./ContextSummaryDisplay.js";
import { AutoAcceptIndicator } from "./AutoAcceptIndicator.js";
import { ShellModeIndicator } from "./ShellModeIndicator.js";
import { DetailedMessagesDisplay } from "./DetailedMessagesDisplay.js";
import { InputPrompt } from "./InputPrompt.js";
import { Footer } from "./Footer.js";
import { ShowMoreLines } from "./ShowMoreLines.js";
import { OverflowProvider } from "../contexts/OverflowContext.js";
import { Colors } from "../colors.js";
import { isNarrowWidth } from "../utils/isNarrowWidth.js";
import { useUIState } from "../contexts/UIStateContext.js";
import { useUIActions } from "../contexts/UIActionsContext.js";
import { useVimMode } from "../contexts/VimModeContext.js";
import { useConfig } from "../contexts/ConfigContext.js";
import { useSettings } from "../contexts/SettingsContext.js";
import { ApprovalMode } from "@google/kaidex-cli-core";
import { StreamingState } from "../types.js";
import { ConfigInitDisplay } from "../components/ConfigInitDisplay.js";
const MAX_DISPLAYED_QUEUED_MESSAGES = 3;
export const Composer = () => {
    const config = useConfig();
    const settings = useSettings();
    const uiState = useUIState();
    const uiActions = useUIActions();
    const { vimEnabled, vimMode } = useVimMode();
    const terminalWidth = process.stdout.columns;
    const isNarrow = isNarrowWidth(terminalWidth);
    const debugConsoleMaxHeight = Math.floor(Math.max(terminalWidth * 0.2, 5));
    const { contextFileNames, showAutoAcceptIndicator } = uiState;
    // Estimate streaming output tokens from CURRENT response only (not accumulated)
    const streamingOutputTokens = uiState.streamingState === StreamingState.Responding
        ? (() => {
            // Estimate from current pending content length
            if (uiState.pendingGeminiHistoryItems.length > 0) {
                const lastItem = uiState.pendingGeminiHistoryItems[uiState.pendingGeminiHistoryItems.length - 1];
                if (lastItem?.type === "gemini" && lastItem.text) {
                    // Rough estimate: 1 token ≈ 4 characters
                    return Math.ceil(lastItem.text.length / 4);
                }
            }
            return 0;
        })()
        : 0;
    // Build footer props from context values
    const footerProps = {
        model: config.getModel(),
        targetDir: config.getTargetDir(),
        debugMode: config.getDebugMode(),
        branchName: uiState.branchName,
        debugMessage: uiState.debugMessage,
        corgiMode: uiState.corgiMode,
        errorCount: uiState.errorCount,
        showErrorDetails: uiState.showErrorDetails,
        showMemoryUsage: config.getDebugMode() || settings.merged.ui?.showMemoryUsage || false,
        promptTokenCount: uiState.sessionStats.lastPromptTokenCount,
        nightly: uiState.nightly,
        isTrustedFolder: uiState.isTrustedFolder,
    };
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(LoadingIndicator, { thought: uiState.streamingState === StreamingState.WaitingForConfirmation ||
                    config.getAccessibility()?.disableLoadingPhrases
                    ? undefined
                    : uiState.thought, currentLoadingPhrase: config.getAccessibility()?.disableLoadingPhrases
                    ? undefined
                    : uiState.currentLoadingPhrase, elapsedTime: uiState.elapsedTime, streamingOutputTokens: streamingOutputTokens, model: config.getModel() }), !uiState.isConfigInitialized && _jsx(ConfigInitDisplay, {}), uiState.messageQueue.length > 0 && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [uiState.messageQueue
                        .slice(0, MAX_DISPLAYED_QUEUED_MESSAGES)
                        .map((message, index) => {
                        const preview = message.replace(/\s+/g, " ");
                        return (_jsx(Box, { paddingLeft: 2, width: "100%", children: _jsx(Text, { dimColor: true, wrap: "truncate", children: preview }) }, index));
                    }), uiState.messageQueue.length > MAX_DISPLAYED_QUEUED_MESSAGES && (_jsx(Box, { paddingLeft: 2, children: _jsxs(Text, { dimColor: true, children: ["... (+", uiState.messageQueue.length -
                                    MAX_DISPLAYED_QUEUED_MESSAGES, " ", "more)"] }) }))] })), _jsxs(Box, { marginTop: 1, justifyContent: "space-between", width: "100%", flexDirection: isNarrow ? "column" : "row", alignItems: isNarrow ? "flex-start" : "center", children: [_jsxs(Box, { children: [process.env["KAIDEX_SYSTEM_MD"] && (_jsx(Text, { color: Colors.AccentRed, children: "|\u2310\u25A0_\u25A0| " })), uiState.ctrlCPressedOnce ? (_jsx(Text, { color: Colors.AccentYellow, children: "Press Ctrl+C again to exit." })) : uiState.ctrlDPressedOnce ? (_jsx(Text, { color: Colors.AccentYellow, children: "Press Ctrl+D again to exit." })) : uiState.showEscapePrompt ? (_jsx(Text, { color: Colors.Gray, children: "Press Esc again to clear." })) : (!settings.merged.ui?.hideContextSummary && (_jsx(ContextSummaryDisplay, { ideContext: uiState.ideContextState, kaidexMdFileCount: uiState.kaidexMdFileCount, contextFileNames: contextFileNames, mcpServers: config.getMcpServers(), blockedMcpServers: config.getBlockedMcpServers(), showToolDescriptions: uiState.showToolDescriptions })))] }), _jsxs(Box, { paddingTop: isNarrow ? 1 : 0, children: [showAutoAcceptIndicator !== ApprovalMode.DEFAULT &&
                                !uiState.shellModeActive && (_jsx(AutoAcceptIndicator, { approvalMode: showAutoAcceptIndicator })), uiState.shellModeActive && _jsx(ShellModeIndicator, {})] })] }), uiState.showErrorDetails && (_jsx(OverflowProvider, { children: _jsxs(Box, { flexDirection: "column", children: [_jsx(DetailedMessagesDisplay, { messages: uiState.filteredConsoleMessages, maxHeight: uiState.constrainHeight ? debugConsoleMaxHeight : undefined, width: uiState.inputWidth }), _jsx(ShowMoreLines, { constrainHeight: uiState.constrainHeight })] }) })), uiState.isInputActive && (_jsx(InputPrompt, { buffer: uiState.buffer, inputWidth: uiState.inputWidth, suggestionsWidth: uiState.suggestionsWidth, onSubmit: uiActions.handleFinalSubmit, userMessages: uiState.userMessages, onClearScreen: uiActions.handleClearScreen, config: config, slashCommands: uiState.slashCommands, commandContext: uiState.commandContext, shellModeActive: uiState.shellModeActive, setShellModeActive: uiActions.setShellModeActive, onEscapePromptChange: uiActions.onEscapePromptChange, focus: uiState.isFocused, vimHandleInput: uiActions.vimHandleInput, placeholder: vimEnabled
                    ? "  Press 'i' for INSERT mode and 'Esc' for NORMAL mode."
                    : "  Type your message or @path/to/file" })), !settings.merged.ui?.hideFooter && (_jsx(Footer, { ...footerProps, vimMode: vimEnabled ? vimMode : undefined }))] }));
};
//# sourceMappingURL=Composer.js.map