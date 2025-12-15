/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Part as GooglePart,
  Content as GoogleContent,
} from "@google/genai";
import type {
  Part as KaidexPart,
  PartListUnion as KaidexPartListUnion,
  Content as KaidexContent,
} from "../core/contentGenerator.js";

/**
 * Adapter: Convert Google Part to Kaidex Part
 * Maintains Google SDK power while enabling Kaidex local LLM freedom
 */
export function googleToKaidex(googlePart: GooglePart): KaidexPart {
  console.log(
    "🔄 ADAPTER_GOOGLE_TO_KAIDEX: Converting Google Part to Kaidex Part",
    JSON.stringify(googlePart, null, 2),
  );

  // CRITICAL: Only include properties that exist.
  // DO NOT include undefined properties - they will break 'in' operator checks!
  const result: KaidexPart = {};

  if (googlePart.text !== undefined) {
    result.text = googlePart.text;
  }

  if (googlePart.inlineData) {
    result.inlineData = {
      mimeType: googlePart.inlineData.mimeType || "unknown",
      data: googlePart.inlineData.data || "",
    };
  }

  if (googlePart.fileData) {
    result.fileData = {
      mimeType: googlePart.fileData.mimeType || "unknown",
      fileUri: googlePart.fileData.fileUri || "",
    };
  }

  if (googlePart.functionCall) {
    result.functionCall = {
      name: googlePart.functionCall.name || "unknown",
      args: googlePart.functionCall.args || {},
      id: googlePart.functionCall.id, // Preserve id for XML detection
    };
  }

  if (googlePart.functionResponse) {
    result.functionResponse = {
      name: googlePart.functionResponse.name || "unknown",
      response: googlePart.functionResponse.response || {},
    };
  }

  if (googlePart.executableCode) {
    result.executableCode = {
      // Convert Google's restrictive Language enum to liberal string
      language: googlePart.executableCode.language || "unknown",
      code: googlePart.executableCode.code || "",
    };
  }

  if (googlePart.codeExecutionResult) {
    result.codeExecutionResult = {
      // Convert Google's restrictive Outcome enum to liberal string
      outcome: googlePart.codeExecutionResult.outcome || "unknown",
      output: googlePart.codeExecutionResult.output,
    };
  }

  return result;
}

/**
 * Adapter: Convert Kaidex Part to Google Part
 * For when Google SDK needs Kaidex data
 */
export function kaidexToGoogle(kaidexPart: KaidexPart): GooglePart {
  console.log(
    "🔄 ADAPTER_KAIDEX_TO_GOOGLE: Converting Kaidex Part to Google Part",
    JSON.stringify(kaidexPart, null, 2),
  );
  return {
    text: kaidexPart.text,
    inlineData: kaidexPart.inlineData,
    fileData: kaidexPart.fileData,
    functionCall: kaidexPart.functionCall,
    functionResponse: kaidexPart.functionResponse,
    executableCode: kaidexPart.executableCode
      ? {
          // Map liberal string back to Google's enum (best effort) with type assertion
          language: (kaidexPart.executableCode.language === "python"
            ? "PYTHON"
            : "LANGUAGE_UNSPECIFIED") as any,
          code: kaidexPart.executableCode.code,
        }
      : undefined,
    codeExecutionResult: kaidexPart.codeExecutionResult
      ? {
          // Map liberal string back to Google's enum (best effort) with type assertion
          outcome: (kaidexPart.codeExecutionResult.outcome === "success"
            ? "OUTCOME_OK"
            : "OUTCOME_FAILED") as any,
          output: kaidexPart.codeExecutionResult.output,
        }
      : undefined,
  };
}

/**
 * Adapter: Convert Google Part array to Kaidex PartListUnion
 */
export function googleArrayToKaidex(
  googleParts: GooglePart[],
): KaidexPartListUnion {
  console.log(
    "🔄 ADAPTER_GOOGLE_ARRAY_TO_KAIDEX: Converting Google Part array to Kaidex PartListUnion, count:",
    googleParts.length,
  );
  return googleParts.map(googleToKaidex);
}

/**
 * Adapter: Convert Google Part array to Kaidex Part array (forced array type)
 */
export function googleArrayToKaidexArray(
  googleParts: GooglePart[],
): KaidexPart[] {
  console.log(
    "🔄 ADAPTER_GOOGLE_ARRAY_TO_KAIDEX_ARRAY: Converting Google Part array to Kaidex Part array, count:",
    googleParts.length,
  );
  return googleParts.map(googleToKaidex);
}

/**
 * Adapter: Convert Kaidex PartListUnion to Google Part array
 */
export function kaidexToGoogleArray(
  kaidexParts: KaidexPartListUnion,
): GooglePart[] {
  if (typeof kaidexParts === "string") {
    return [{ text: kaidexParts }];
  }
  return kaidexParts.map(kaidexToGoogle);
}

/**
 * Adapter: Convert PartListUnion (string | Part[]) to Kaidex Part array
 * COMPLETE END-TO-END: Handles both string and Part[] cases
 */
export function partListUnionToKaidexArray(partListUnion: any): KaidexPart[] {
  console.log(
    "🔄 ADAPTER_PARTLISTUNION_TO_KAIDEX_ARRAY: Input type:",
    typeof partListUnion,
    "isArray:",
    Array.isArray(partListUnion),
  );
  console.log(
    "🔄 ADAPTER_PARTLISTUNION_TO_KAIDEX_ARRAY: Input value:",
    JSON.stringify(partListUnion, null, 2),
  );

  if (typeof partListUnion === "string") {
    return [{ text: partListUnion }];
  }
  if (Array.isArray(partListUnion)) {
    return partListUnion.map(googleToKaidex);
  }
  // Fallback - convert to text
  return [{ text: String(partListUnion) }];
}

/**
 * Adapter: Convert Google Content to Kaidex Content
 * Maintains Google SDK power while enabling Kaidex local LLM freedom
 */
export function googleContentToKaidex(
  googleContent: GoogleContent,
): KaidexContent {
  console.log(
    "🔄 ADAPTER_GOOGLE_CONTENT_TO_KAIDEX: Converting Google Content to Kaidex Content",
    JSON.stringify(googleContent, null, 2),
  );
  return {
    role: googleContent.role,
    parts: googleContent.parts
      ? googleContent.parts.map(googleToKaidex)
      : undefined,
  };
}

/**
 * Adapter: Convert Kaidex Content to Google Content
 * For when Google SDK needs Kaidex data
 */
export function kaidexContentToGoogle(
  kaidexContent: KaidexContent,
): GoogleContent {
  console.log(
    "🔄 ADAPTER_KAIDEX_CONTENT_TO_GOOGLE: Converting Kaidex Content to Google Content",
    JSON.stringify(kaidexContent, null, 2),
  );
  return {
    role: kaidexContent.role,
    parts: kaidexContent.parts
      ? kaidexContent.parts.map(kaidexToGoogle)
      : undefined,
  };
}

/**
 * Adapter: Convert Google Content array to Kaidex Content array
 */
export function googleContentArrayToKaidex(
  googleContents: GoogleContent[],
): KaidexContent[] {
  console.log(
    "🔄 ADAPTER_GOOGLE_CONTENT_ARRAY_TO_KAIDEX: Converting Google Content array to Kaidex Content array, count:",
    googleContents.length,
  );
  return googleContents.map(googleContentToKaidex);
}

/**
 * Adapter: Convert Kaidex Content array to Google Content array
 */
export function kaidexContentArrayToGoogle(
  kaidexContents: KaidexContent[],
): GoogleContent[] {
  console.log(
    "🔄 ADAPTER_KAIDEX_CONTENT_ARRAY_TO_GOOGLE: Converting Kaidex Content array to Google Content array, count:",
    kaidexContents.length,
  );
  return kaidexContents.map(kaidexContentToGoogle);
}

/**
 * Adapter: Convert Google GenerateContentResponse to Kaidex GenerateContentResponse for TEST MOCKING
 * SOLID FINDINGS: Tests use Google response format but Kaidex functions expect Kaidex format
 */
export function googleGenerateContentResponseToKaidexForTesting(
  googleResponse: any,
): any {
  console.log(
    "🔄 ADAPTER_GOOGLE_TO_KAIDEX_TESTING: Converting Google test response to Kaidex format",
  );

  // Based on SOLID FINDINGS from interface analysis:
  // Google: { candidates, promptFeedback, usageMetadata }
  // Kaidex: { response: { candidates }, candidates?, usageMetadata? }

  return {
    response: {
      candidates: googleResponse.candidates || [],
    },
    candidates: googleResponse.candidates,
    usageMetadata: googleResponse.usageMetadata,
  };
}

/**
 * Adapter: Convert Google AsyncGenerator to Kaidex AsyncGenerator for TEST STREAM MOCKING
 * SOLID FINDINGS: Tests use Google stream format but Kaidex functions expect Kaidex stream format
 */
export async function* googleStreamToKaidexForTesting(
  googleStream: AsyncGenerator<any>,
): AsyncGenerator<any> {
  console.log(
    "🔄 ADAPTER_GOOGLE_STREAM_TO_KAIDEX_TESTING: Converting Google test stream to Kaidex format",
  );

  for await (const chunk of googleStream) {
    yield googleGenerateContentResponseToKaidexForTesting(chunk);
  }
}
