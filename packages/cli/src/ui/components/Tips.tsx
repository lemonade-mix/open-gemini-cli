/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from "react";
import { Box, Text } from "ink";
import { Colors } from "../colors.js";

interface TipsProps {
  // Keeping props for future tips that may use config.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config?: any;
}

export const Tips: React.FC<TipsProps> = () => {
  return (
    <Box flexDirection="column">
      <Text color={Colors.AccentCyan}>Welcome to the GRID</Text>
    </Box>
  );
};
