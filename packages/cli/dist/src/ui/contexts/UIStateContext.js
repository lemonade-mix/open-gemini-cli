/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { createContext, useContext } from "react";
export const UIStateContext = createContext(null);
export const useUIState = () => {
    const context = useContext(UIStateContext);
    if (!context) {
        throw new Error("useUIState must be used within a UIStateProvider");
    }
    return context;
};
//# sourceMappingURL=UIStateContext.js.map