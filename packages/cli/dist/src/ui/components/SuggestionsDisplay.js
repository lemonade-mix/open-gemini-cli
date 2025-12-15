import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { Box, Text } from "ink";
import { Colors } from "../colors.js";
import { PrepareLabel } from "./PrepareLabel.js";
import { CommandKind } from "../commands/types.js";
export const MAX_SUGGESTIONS_TO_SHOW = 8;
export function SuggestionsDisplay({ suggestions, activeIndex, isLoading, width, scrollOffset, userInput, }) {
    if (isLoading) {
        return (_jsx(Box, { paddingX: 1, width: width, children: _jsx(Text, { color: "gray", children: "Loading suggestions..." }) }));
    }
    if (suggestions.length === 0) {
        return null; // Don't render anything if there are no suggestions
    }
    // Calculate the visible slice based on scrollOffset
    const startIndex = scrollOffset;
    const endIndex = Math.min(scrollOffset + MAX_SUGGESTIONS_TO_SHOW, suggestions.length);
    const visibleSuggestions = suggestions.slice(startIndex, endIndex);
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, width: width, children: [scrollOffset > 0 && _jsx(Text, { color: Colors.Foreground, children: "\u25B2" }), visibleSuggestions.map((suggestion, index) => {
                const originalIndex = startIndex + index;
                const isActive = originalIndex === activeIndex;
                const textColor = isActive ? Colors.AccentPurple : Colors.Gray;
                const labelElement = (_jsx(PrepareLabel, { label: suggestion.label, matchedIndex: suggestion.matchedIndex, userInput: userInput, textColor: textColor }));
                return (_jsx(Box, { width: width, children: _jsx(Box, { flexDirection: "row", children: (() => {
                            const isSlashCommand = userInput.startsWith("/");
                            return (_jsxs(_Fragment, { children: [isSlashCommand ? (_jsxs(Box, { flexShrink: 0, paddingRight: 2, children: [labelElement, suggestion.commandKind === CommandKind.MCP_PROMPT && (_jsx(Text, { color: Colors.Gray, children: " [MCP]" }))] })) : (labelElement), suggestion.description && (_jsx(Box, { flexGrow: 1, paddingLeft: isSlashCommand ? undefined : 1, children: _jsx(Text, { color: textColor, wrap: "truncate", children: suggestion.description }) }))] }));
                        })() }) }, `${suggestion.value}-${originalIndex}`));
            }), endIndex < suggestions.length && _jsx(Text, { color: "gray", children: "\u25BC" }), suggestions.length > MAX_SUGGESTIONS_TO_SHOW && (_jsxs(Text, { color: "gray", children: ["(", activeIndex + 1, "/", suggestions.length, ")"] }))] }));
}
//# sourceMappingURL=SuggestionsDisplay.js.map