/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type React from "react";
import type { SpinnerName } from "cli-spinners";
interface KaiDexRespondingSpinnerProps {
    /**
     * Optional string to display when not in Responding state.
     * If not provided and not Responding, renders null.
     */
    nonRespondingDisplay?: string;
    spinnerType?: SpinnerName;
}
export declare const KaiDexRespondingSpinner: React.FC<KaiDexRespondingSpinnerProps>;
interface KaiDexSpinnerProps {
    spinnerType?: SpinnerName;
    altText?: string;
}
export declare const KaiDexSpinner: React.FC<KaiDexSpinnerProps>;
export {};
