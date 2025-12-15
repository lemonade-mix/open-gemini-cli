/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Storage } from "@google/kaidex-cli-core";
import { Logger } from "@google/kaidex-cli-core";
/**
 * Hook to manage the logger instance.
 */
export declare const useLogger: (storage: Storage) => Logger | null;
