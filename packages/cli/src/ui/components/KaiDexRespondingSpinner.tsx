/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from "react";
import { Text, useIsScreenReaderEnabled } from "ink";
import Spinner from "ink-spinner";
import type { SpinnerName } from "cli-spinners";
import { useStreamingContext } from "../contexts/StreamingContext.js";
import { StreamingState } from "../types.js";
import {
  SCREEN_READER_LOADING,
  SCREEN_READER_RESPONDING,
} from "../textConstants.js";

interface KaiDexRespondingSpinnerProps {
  /**
   * Optional string to display when not in Responding state.
   * If not provided and not Responding, renders null.
   */
  nonRespondingDisplay?: string;
  spinnerType?: SpinnerName;
}

export const KaiDexRespondingSpinner: React.FC<
  KaiDexRespondingSpinnerProps
> = ({ nonRespondingDisplay, spinnerType = "dots" }) => {
  const streamingState = useStreamingContext();
  const isScreenReaderEnabled = useIsScreenReaderEnabled();
  if (streamingState === StreamingState.Responding) {
    return (
      <KaiDexSpinner
        spinnerType={spinnerType}
        altText={SCREEN_READER_RESPONDING}
      />
    );
  } else if (nonRespondingDisplay) {
    return isScreenReaderEnabled ? (
      <Text>{SCREEN_READER_LOADING}</Text>
    ) : (
      <Text>{nonRespondingDisplay}</Text>
    );
  }
  return null;
};

interface KaiDexSpinnerProps {
  spinnerType?: SpinnerName;
  altText?: string;
}

export const KaiDexSpinner: React.FC<KaiDexSpinnerProps> = ({
  spinnerType = "dots",
  altText,
}) => {
  const isScreenReaderEnabled = useIsScreenReaderEnabled();
  return isScreenReaderEnabled ? (
    <Text>{altText}</Text>
  ) : (
    <Spinner type={spinnerType} />
  );
};
