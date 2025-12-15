/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Newline, Text } from "ink";
import { Colors } from "../colors.js";
import { useKeypress } from "../hooks/useKeypress.js";

interface KaiDexPrivacyNoticeProps {
  onExit: () => void;
}

export const KaiDexPrivacyNotice = ({ onExit }: KaiDexPrivacyNoticeProps) => {
  useKeypress(
    (key) => {
      if (key.name === "escape") {
        onExit();
      }
    },
    { isActive: true },
  );

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={Colors.AccentPurple}>
        KaiDex API Key Notice
      </Text>
      <Newline />
      <Text>
        By using the KaiDex API<Text color={Colors.AccentBlue}>[1]</Text>,
        Google AI Studio
        <Text color={Colors.AccentRed}>[2]</Text>, and the other Google
        developer services that reference these terms (collectively, the
        &quot;APIs&quot; or &quot;Services&quot;), you are agreeing to Google
        APIs Terms of Service (the &quot;API Terms&quot;)
        <Text color={Colors.AccentGreen}>[3]</Text>, and the KaiDex API
        Additional Terms of Service (the &quot;Additional Terms&quot;)
        <Text color={Colors.AccentPurple}>[4]</Text>.
      </Text>
      <Newline />
      <Text>
        <Text color={Colors.AccentBlue}>[1]</Text>{" "}
        https://ai.google.dev/docs/gemini_api_overview
      </Text>
      <Text>
        <Text color={Colors.AccentRed}>[2]</Text> https://aistudio.google.com/
      </Text>
      <Text>
        <Text color={Colors.AccentGreen}>[3]</Text>{" "}
        https://developers.google.com/terms
      </Text>
      <Text>
        <Text color={Colors.AccentPurple}>[4]</Text>{" "}
        https://ai.google.dev/gemini-api/terms
      </Text>
      <Newline />
      <Text color={Colors.Gray}>Press Esc to exit.</Text>
    </Box>
  );
};
