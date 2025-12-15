/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {} from "./contentGenerator.js";
import { partToString } from "../utils/partUtils.js";
import { partListUnionToKaidexArray, kaidexToGoogleArray, } from "../utils/typeAdapters.js";
export function partListUnionToString(value) {
    return partToString(kaidexToGoogleArray(partListUnionToKaidexArray(value)), {
        verbose: true,
    });
}
//# sourceMappingURL=kaidexRequest.js.map