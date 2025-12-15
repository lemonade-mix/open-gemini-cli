import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { Box } from "ink";
import { StreamingContext } from "./contexts/StreamingContext.js";
import { Notifications } from "./components/Notifications.js";
import { MainContent } from "./components/MainContent.js";
import { DialogManager } from "./components/DialogManager.js";
import { Composer } from "./components/Composer.js";
import { useUIState } from "./contexts/UIStateContext.js";
import { QuittingDisplay } from "./components/QuittingDisplay.js";
export const App = () => {
    const uiState = useUIState();
    if (uiState.quittingMessages) {
        return _jsx(QuittingDisplay, {});
    }
    return (_jsx(StreamingContext.Provider, { value: uiState.streamingState, children: _jsxs(Box, { flexDirection: "column", width: "90%", children: [_jsx(MainContent, {}), _jsxs(Box, { flexDirection: "column", ref: uiState.mainControlsRef, children: [_jsx(Notifications, {}), uiState.dialogsVisible ? _jsx(DialogManager, {}) : _jsx(Composer, {})] })] }) }));
};
//# sourceMappingURL=App.js.map