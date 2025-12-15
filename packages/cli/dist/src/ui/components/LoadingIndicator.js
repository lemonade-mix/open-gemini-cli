import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { Colors } from "../colors.js";
import { useStreamingContext } from "../contexts/StreamingContext.js";
import { StreamingState } from "../types.js";
import { KaiDexRespondingSpinner } from "./KaiDexRespondingSpinner.js";
import { useTerminalSize } from "../hooks/useTerminalSize.js";
import { isNarrowWidth } from "../utils/isNarrowWidth.js";
export const LoadingIndicator = ({ currentLoadingPhrase, elapsedTime, rightContent, thought, streamingOutputTokens, }) => {
    const streamingState = useStreamingContext();
    const { columns: terminalWidth } = useTerminalSize();
    const isNarrow = isNarrowWidth(terminalWidth);
    if (streamingState === StreamingState.Idle) {
        return null;
    }
    const primaryText = thought?.subject || currentLoadingPhrase;
    // Format time as "5m 13s" or "42s"
    const formatTime = (seconds) => {
        if (seconds < 60)
            return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };
    // Format token usage (streaming output tokens - live count as LLM responds)
    const tokenInfo = streamingOutputTokens
        ? (() => {
            const tokensFormatted = streamingOutputTokens >= 1000
                ? `${(streamingOutputTokens / 1000).toFixed(1)}k`
                : streamingOutputTokens.toString();
            return `↓ ${tokensFormatted} tokens`;
        })()
        : "";
    const cancelAndTimerContent = streamingState !== StreamingState.WaitingForConfirmation
        ? `(esc to interrupt · ctrl+t to show todos · ${formatTime(elapsedTime)}${tokenInfo ? ` · ${tokenInfo}` : ""})`
        : null;
    return (_jsxs(Box, { paddingLeft: 0, flexDirection: "column", children: [_jsxs(Box, { width: "100%", flexDirection: isNarrow ? "column" : "row", alignItems: isNarrow ? "flex-start" : "center", children: [_jsxs(Box, { children: [_jsx(Box, { marginRight: 1, children: _jsx(KaiDexRespondingSpinner, { nonRespondingDisplay: streamingState === StreamingState.WaitingForConfirmation
                                        ? "⠏"
                                        : "" }) }), primaryText && (_jsx(Text, { color: Colors.AccentPurple, children: primaryText })), !isNarrow && cancelAndTimerContent && (_jsxs(Text, { color: Colors.Gray, children: [" ", cancelAndTimerContent] }))] }), !isNarrow && _jsx(Box, { flexGrow: 1 }), !isNarrow && rightContent && _jsx(Box, { children: rightContent })] }), isNarrow && cancelAndTimerContent && (_jsx(Box, { children: _jsx(Text, { color: Colors.Gray, children: cancelAndTimerContent }) })), isNarrow && rightContent && _jsx(Box, { children: rightContent })] }));
};
//# sourceMappingURL=LoadingIndicator.js.map