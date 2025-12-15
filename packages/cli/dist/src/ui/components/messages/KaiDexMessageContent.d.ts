/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type React from "react";
interface KaiDexMessageContentProps {
    text: string;
    isPending: boolean;
    availableTerminalHeight?: number;
    terminalWidth: number;
}
export declare const KaiDexMessageContent: React.FC<KaiDexMessageContentProps>;
export {};
