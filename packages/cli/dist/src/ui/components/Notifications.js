import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { Box, Text } from "ink";
import { useAppContext } from "../contexts/AppContext.js";
import { useUIState } from "../contexts/UIStateContext.js";
import { Colors } from "../colors.js";
import { StreamingState } from "../types.js";
import { UpdateNotification } from "./UpdateNotification.js";
export const Notifications = () => {
    const { startupWarnings } = useAppContext();
    const { initError, streamingState, updateInfo } = useUIState();
    const showStartupWarnings = startupWarnings.length > 0;
    const showInitError = initError && streamingState !== StreamingState.Responding;
    if (!showStartupWarnings && !showInitError && !updateInfo) {
        return null;
    }
    return (_jsxs(_Fragment, { children: [updateInfo && _jsx(UpdateNotification, { message: updateInfo.message }), showStartupWarnings && (_jsx(Box, { borderStyle: "round", borderColor: Colors.AccentYellow, paddingX: 1, marginY: 1, flexDirection: "column", children: startupWarnings.map((warning, index) => (_jsx(Text, { color: Colors.AccentYellow, children: warning }, index))) })), showInitError && (_jsxs(Box, { borderStyle: "round", borderColor: Colors.AccentRed, paddingX: 1, marginBottom: 1, children: [_jsxs(Text, { color: Colors.AccentRed, children: ["Initialization Error: ", initError] }), _jsxs(Text, { color: Colors.AccentRed, children: [" ", "Please check API key and configuration."] })] }))] }));
};
//# sourceMappingURL=Notifications.js.map