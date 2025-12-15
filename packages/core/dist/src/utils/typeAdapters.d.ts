/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Part as GooglePart, Content as GoogleContent } from "@google/genai";
import type { Part as KaidexPart, PartListUnion as KaidexPartListUnion, Content as KaidexContent } from "../core/contentGenerator.js";
/**
 * Adapter: Convert Google Part to Kaidex Part
 * Maintains Google SDK power while enabling Kaidex local LLM freedom
 */
export declare function googleToKaidex(googlePart: GooglePart): KaidexPart;
/**
 * Adapter: Convert Kaidex Part to Google Part
 * For when Google SDK needs Kaidex data
 */
export declare function kaidexToGoogle(kaidexPart: KaidexPart): GooglePart;
/**
 * Adapter: Convert Google Part array to Kaidex PartListUnion
 */
export declare function googleArrayToKaidex(googleParts: GooglePart[]): KaidexPartListUnion;
/**
 * Adapter: Convert Google Part array to Kaidex Part array (forced array type)
 */
export declare function googleArrayToKaidexArray(googleParts: GooglePart[]): KaidexPart[];
/**
 * Adapter: Convert Kaidex PartListUnion to Google Part array
 */
export declare function kaidexToGoogleArray(kaidexParts: KaidexPartListUnion): GooglePart[];
/**
 * Adapter: Convert PartListUnion (string | Part[]) to Kaidex Part array
 * COMPLETE END-TO-END: Handles both string and Part[] cases
 */
export declare function partListUnionToKaidexArray(partListUnion: any): KaidexPart[];
/**
 * Adapter: Convert Google Content to Kaidex Content
 * Maintains Google SDK power while enabling Kaidex local LLM freedom
 */
export declare function googleContentToKaidex(googleContent: GoogleContent): KaidexContent;
/**
 * Adapter: Convert Kaidex Content to Google Content
 * For when Google SDK needs Kaidex data
 */
export declare function kaidexContentToGoogle(kaidexContent: KaidexContent): GoogleContent;
/**
 * Adapter: Convert Google Content array to Kaidex Content array
 */
export declare function googleContentArrayToKaidex(googleContents: GoogleContent[]): KaidexContent[];
/**
 * Adapter: Convert Kaidex Content array to Google Content array
 */
export declare function kaidexContentArrayToGoogle(kaidexContents: KaidexContent[]): GoogleContent[];
/**
 * Adapter: Convert Google GenerateContentResponse to Kaidex GenerateContentResponse for TEST MOCKING
 * SOLID FINDINGS: Tests use Google response format but Kaidex functions expect Kaidex format
 */
export declare function googleGenerateContentResponseToKaidexForTesting(googleResponse: any): any;
/**
 * Adapter: Convert Google AsyncGenerator to Kaidex AsyncGenerator for TEST STREAM MOCKING
 * SOLID FINDINGS: Tests use Google stream format but Kaidex functions expect Kaidex stream format
 */
export declare function googleStreamToKaidexForTesting(googleStream: AsyncGenerator<any>): AsyncGenerator<any>;
