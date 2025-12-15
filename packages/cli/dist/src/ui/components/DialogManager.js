import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { Box, Text } from "ink";
import { IdeIntegrationNudge } from "../IdeIntegrationNudge.js";
import { FolderTrustDialog } from "./FolderTrustDialog.js";
import { ShellConfirmationDialog } from "./ShellConfirmationDialog.js";
import { RadioButtonSelect } from "./shared/RadioButtonSelect.js";
import { ThemeDialog } from "./ThemeDialog.js";
import { SettingsDialog } from "./SettingsDialog.js";
import { AuthInProgress } from "../auth/AuthInProgress.js";
import { AuthDialog } from "../auth/AuthDialog.js";
import { EditorSettingsDialog } from "./EditorSettingsDialog.js";
import { PrivacyNotice } from "../privacy/PrivacyNotice.js";
import { WorkspaceMigrationDialog } from "./WorkspaceMigrationDialog.js";
import { ProQuotaDialog } from "./ProQuotaDialog.js";
import { Colors } from "../colors.js";
import { useUIState } from "../contexts/UIStateContext.js";
import { useUIActions } from "../contexts/UIActionsContext.js";
import { useConfig } from "../contexts/ConfigContext.js";
import { useSettings } from "../contexts/SettingsContext.js";
import process from "node:process";
// Props for DialogManager
export const DialogManager = () => {
    const config = useConfig();
    const settings = useSettings();
    const uiState = useUIState();
    const uiActions = useUIActions();
    const { constrainHeight, terminalHeight, staticExtraHeight, mainAreaWidth } = uiState;
    if (uiState.showIdeRestartPrompt) {
        return (_jsx(Box, { borderStyle: "round", borderColor: Colors.AccentYellow, paddingX: 1, children: _jsx(Text, { color: Colors.AccentYellow, children: "Workspace trust has changed. Press 'r' to restart KaiDex to apply the changes." }) }));
    }
    if (uiState.showWorkspaceMigrationDialog) {
        return (_jsx(WorkspaceMigrationDialog, { workspaceExtensions: uiState.workspaceExtensions, onOpen: uiActions.onWorkspaceMigrationDialogOpen, onClose: uiActions.onWorkspaceMigrationDialogClose }));
    }
    if (uiState.proQuotaRequest) {
        return (_jsx(ProQuotaDialog, { failedModel: uiState.proQuotaRequest.failedModel, fallbackModel: uiState.proQuotaRequest.fallbackModel, onChoice: uiActions.handleProQuotaChoice }));
    }
    if (uiState.shouldShowIdePrompt) {
        return (_jsx(IdeIntegrationNudge, { ide: uiState.currentIDE, onComplete: uiActions.handleIdePromptComplete }));
    }
    if (uiState.isFolderTrustDialogOpen) {
        return (_jsx(FolderTrustDialog, { onSelect: uiActions.handleFolderTrustSelect, isRestarting: uiState.isRestarting }));
    }
    if (uiState.shellConfirmationRequest) {
        return (_jsx(ShellConfirmationDialog, { request: uiState.shellConfirmationRequest }));
    }
    if (uiState.confirmationRequest) {
        return (_jsxs(Box, { flexDirection: "column", children: [uiState.confirmationRequest.prompt, _jsx(Box, { paddingY: 1, children: _jsx(RadioButtonSelect, { items: [
                            { label: "Yes", value: true },
                            { label: "No", value: false },
                        ], onSelect: (value) => {
                            uiState.confirmationRequest.onConfirm(value);
                        } }) })] }));
    }
    if (uiState.isThemeDialogOpen) {
        return (_jsxs(Box, { flexDirection: "column", children: [uiState.themeError && (_jsx(Box, { marginBottom: 1, children: _jsx(Text, { color: Colors.AccentRed, children: uiState.themeError }) })), _jsx(ThemeDialog, { onSelect: uiActions.handleThemeSelect, onHighlight: uiActions.handleThemeHighlight, settings: settings, availableTerminalHeight: constrainHeight ? terminalHeight - staticExtraHeight : undefined, terminalWidth: mainAreaWidth })] }));
    }
    if (uiState.isSettingsDialogOpen) {
        return (_jsx(Box, { flexDirection: "column", children: _jsx(SettingsDialog, { settings: settings, onSelect: () => uiActions.closeSettingsDialog(), onRestartRequest: () => process.exit(0) }) }));
    }
    if (uiState.isAuthenticating) {
        return (_jsx(AuthInProgress, { onTimeout: () => {
                uiActions.onAuthError("Authentication cancelled.");
            } }));
    }
    if (uiState.isAuthDialogOpen) {
        return (_jsx(Box, { flexDirection: "column", children: _jsx(AuthDialog, { config: config, settings: settings, setAuthState: uiActions.setAuthState, authError: uiState.authError, onAuthError: uiActions.onAuthError }) }));
    }
    if (uiState.isEditorDialogOpen) {
        return (_jsxs(Box, { flexDirection: "column", children: [uiState.editorError && (_jsx(Box, { marginBottom: 1, children: _jsx(Text, { color: Colors.AccentRed, children: uiState.editorError }) })), _jsx(EditorSettingsDialog, { onSelect: uiActions.handleEditorSelect, settings: settings, onExit: uiActions.exitEditorDialog })] }));
    }
    if (uiState.showPrivacyNotice) {
        return (_jsx(PrivacyNotice, { onExit: () => uiActions.exitPrivacyNotice(), config: config }));
    }
    return null;
};
//# sourceMappingURL=DialogManager.js.map