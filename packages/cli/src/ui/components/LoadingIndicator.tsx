/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ThoughtSummary } from "@google/kaidex-cli-core";
import type React from "react";
import { Box, Text } from "ink";
import { Colors } from "../colors.js";
import { useStreamingContext } from "../contexts/StreamingContext.js";
import { StreamingState } from "../types.js";
import { KaiDexRespondingSpinner } from "./KaiDexRespondingSpinner.js";
import { useTerminalSize } from "../hooks/useTerminalSize.js";
import { isNarrowWidth } from "../utils/isNarrowWidth.js";

interface LoadingIndicatorProps {
  currentLoadingPhrase?: string;
  elapsedTime: number;
  rightContent?: React.ReactNode;
  thought?: ThoughtSummary | null;
  streamingOutputTokens?: number; // Live token count during streaming
  model?: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  currentLoadingPhrase,
  elapsedTime,
  rightContent,
  thought,
  streamingOutputTokens,
}) => {
  const streamingState = useStreamingContext();
  const { columns: terminalWidth } = useTerminalSize();
  const isNarrow = isNarrowWidth(terminalWidth);

  if (streamingState === StreamingState.Idle) {
    return null;
  }

  const primaryText = thought?.subject || currentLoadingPhrase;

  // Format time as "5m 13s" or "42s"
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Format token usage (streaming output tokens - live count as LLM responds)
  const tokenInfo = streamingOutputTokens
    ? (() => {
        const tokensFormatted =
          streamingOutputTokens >= 1000
            ? `${(streamingOutputTokens / 1000).toFixed(1)}k`
            : streamingOutputTokens.toString();
        return `↓ ${tokensFormatted} tokens`;
      })()
    : "";

  const cancelAndTimerContent =
    streamingState !== StreamingState.WaitingForConfirmation
      ? `(esc to interrupt · ctrl+t to show todos · ${formatTime(elapsedTime)}${tokenInfo ? ` · ${tokenInfo}` : ""})`
      : null;

  return (
    <Box paddingLeft={0} flexDirection="column">
      {/* Main loading line */}
      <Box
        width="100%"
        flexDirection={isNarrow ? "column" : "row"}
        alignItems={isNarrow ? "flex-start" : "center"}
      >
        <Box>
          <Box marginRight={1}>
            <KaiDexRespondingSpinner
              nonRespondingDisplay={
                streamingState === StreamingState.WaitingForConfirmation
                  ? "⠏"
                  : ""
              }
            />
          </Box>
          {primaryText && (
            <Text color={Colors.AccentPurple}>{primaryText}</Text>
          )}
          {!isNarrow && cancelAndTimerContent && (
            <Text color={Colors.Gray}> {cancelAndTimerContent}</Text>
          )}
        </Box>
        {!isNarrow && <Box flexGrow={1}>{/* Spacer */}</Box>}
        {!isNarrow && rightContent && <Box>{rightContent}</Box>}
      </Box>
      {isNarrow && cancelAndTimerContent && (
        <Box>
          <Text color={Colors.Gray}>{cancelAndTimerContent}</Text>
        </Box>
      )}
      {isNarrow && rightContent && <Box>{rightContent}</Box>}
    </Box>
  );
};
