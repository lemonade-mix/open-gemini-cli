/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type PartListUnion } from "./contentGenerator.js";
import { partToString } from "../utils/partUtils.js";
import {
  partListUnionToKaidexArray,
  kaidexToGoogleArray,
} from "../utils/typeAdapters.js";

/**
 * Represents a request to be sent to the KaiDex API.
 * For now, it's an alias to PartListUnion as the primary content.
 * This can be expanded later to include other request parameters.
 */
export type KaiDexCodeRequest = PartListUnion;

export function partListUnionToString(value: PartListUnion): string {
  return partToString(kaidexToGoogleArray(partListUnionToKaidexArray(value)), {
    verbose: true,
  });
}
