/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolInvocation, ToolResult } from "./tools.js";
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from "./tools.js";
import { ToolErrorType } from "./tool-error.js";
import { getErrorMessage } from "../utils/errors.js";
import type { Config } from "../config/config.js";
import { getResponseText } from "../utils/partUtils.js";
import { DEFAULT_KAIDEX_FLASH_MODEL } from "../config/models.js";

/**
 * Tavily search result item
 */
interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

/**
 * Tavily API response structure
 */
interface TavilySearchResponse {
  query: string;
  answer?: string;
  results: TavilySearchResult[];
  images?: string[];
  response_time: number;
}

/**
 * Google Custom Search result item
 */
interface GoogleCustomSearchItem {
  title: string;
  link: string;
  snippet: string;
  displayLink?: string;
}

/**
 * Google Custom Search API response structure
 */
interface GoogleCustomSearchResponse {
  items?: GoogleCustomSearchItem[];
  searchInformation?: {
    searchTime: number;
    totalResults: string;
  };
}

/**
 * Parameters for the UnifiedWebSearchTool.
 */
export interface UnifiedWebSearchToolParams {
  /**
   * The search query.
   */
  query: string;

  /**
   * Maximum number of search results to return (1-20).
   * Only applies to Tavily search. Default: 5
   */
  maxResults?: number;
}

/**
 * Extends ToolResult to include sources for web search.
 */
export interface UnifiedWebSearchToolResult extends ToolResult {
  sources?: TavilySearchResult[] | GoogleCustomSearchItem[] | any[];
  answer?: string;
  provider?: "tavily" | "google_custom" | "google_gemini";
}

class UnifiedWebSearchToolInvocation extends BaseToolInvocation<
  UnifiedWebSearchToolParams,
  UnifiedWebSearchToolResult
> {
  constructor(
    private readonly config: Config,
    params: UnifiedWebSearchToolParams,
  ) {
    super(params);
  }

  override getDescription(): string {
    return `Searching the web for: "${this.params.query}"`;
  }

  /**
   * Performs Tavily search (primary method)
   */
  private async performTavilySearch(
    query: string,
    apiKey: string,
    maxResults: number,
    signal: AbortSignal,
  ): Promise<TavilySearchResponse> {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: "basic",
        max_results: maxResults,
        include_answer: true,
        include_raw_content: false,
        include_images: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tavily API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  /**
   * Performs Google Custom Search API (direct API, works with all LLM providers)
   */
  private async performGoogleCustomSearch(
    query: string,
    apiKey: string,
    searchEngineId: string,
    maxResults: number,
    signal: AbortSignal,
  ): Promise<GoogleCustomSearchResponse> {
    const num = Math.min(maxResults, 10); // Google Custom Search max is 10 per request
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=${num}`;

    const response = await fetch(url, { signal });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google Custom Search API error (${response.status}): ${errorText}`,
      );
    }

    return response.json();
  }

  /**
   * Performs Google search via Gemini API (tertiary fallback, Gemini provider only)
   */
  private async performGoogleGeminiSearch(
    query: string,
    signal: AbortSignal,
  ): Promise<any> {
    const geminiClient = this.config.getKaiDexClient();

    const response = await geminiClient.generateContent(
      [{ role: "user", parts: [{ text: query }] }],
      { tools: [{ googleSearch: {} }] },
      signal,
      DEFAULT_KAIDEX_FLASH_MODEL,
    );

    return response;
  }

  async execute(signal: AbortSignal): Promise<UnifiedWebSearchToolResult> {
    const maxResults = Math.min(Math.max(this.params.maxResults || 5, 1), 20);

    // STRATEGY 1: Try Tavily first (works with all LLM providers)
    const tavilyApiKey = process.env["TAVILY_API_KEY"];

    if (tavilyApiKey) {
      try {
        const searchResult = await this.performTavilySearch(
          this.params.query,
          tavilyApiKey,
          maxResults,
          signal,
        );

        if (searchResult.results && searchResult.results.length > 0) {
          // Format Tavily response for LLM
          let llmContent = "";

          if (searchResult.answer) {
            llmContent += `AI Summary: ${searchResult.answer}\n\n`;
          }

          llmContent += `Web search results for "${this.params.query}" (${searchResult.results.length} sources via Tavily):\n\n`;

          searchResult.results.forEach((result, index) => {
            const citationNum = index + 1;
            llmContent += `[${citationNum}] ${result.title}\n`;
            llmContent += `URL: ${result.url}\n`;
            llmContent += `Content: ${result.content}\n`;
            if (result.published_date) {
              llmContent += `Published: ${result.published_date}\n`;
            }
            llmContent += `Relevance Score: ${(result.score * 100).toFixed(1)}%\n`;
            llmContent += "\n";
          });

          llmContent += "Sources:\n";
          searchResult.results.forEach((result, index) => {
            llmContent += `[${index + 1}] ${result.title} (${result.url})\n`;
          });

          return {
            llmContent: llmContent.trim(),
            returnDisplay: `Found ${searchResult.results.length} results via Tavily (${searchResult.response_time.toFixed(2)}s)`,
            sources: searchResult.results,
            answer: searchResult.answer,
            provider: "tavily",
          };
        }
      } catch (tavilyError: unknown) {
        // Tavily failed, log and try next fallback
        console.warn(`Tavily search failed: ${getErrorMessage(tavilyError)}`);
      }
    }

    // STRATEGY 2: Try Google Custom Search API (works with all LLM providers)
    const googleApiKey = process.env["GOOGLE_API_KEY"];
    const googleSearchEngineId = process.env["GOOGLE_SEARCH_ENGINE_ID"];

    if (googleApiKey && googleSearchEngineId) {
      try {
        const searchResult = await this.performGoogleCustomSearch(
          this.params.query,
          googleApiKey,
          googleSearchEngineId,
          maxResults,
          signal,
        );

        if (searchResult.items && searchResult.items.length > 0) {
          // Format Google Custom Search response for LLM
          let llmContent = `Web search results for "${this.params.query}" (${searchResult.items.length} sources via Google Custom Search):\n\n`;

          searchResult.items.forEach((item, index) => {
            const citationNum = index + 1;
            llmContent += `[${citationNum}] ${item.title}\n`;
            llmContent += `URL: ${item.link}\n`;
            llmContent += `Content: ${item.snippet}\n`;
            if (item.displayLink) {
              llmContent += `Domain: ${item.displayLink}\n`;
            }
            llmContent += "\n";
          });

          llmContent += "Sources:\n";
          searchResult.items.forEach((item, index) => {
            llmContent += `[${index + 1}] ${item.title} (${item.link})\n`;
          });

          const searchTime = searchResult.searchInformation?.searchTime || 0;
          const fallbackNote = tavilyApiKey
            ? " (Tavily failed, using Google Custom Search)"
            : "";

          return {
            llmContent: llmContent.trim(),
            returnDisplay: `Found ${searchResult.items.length} results via Google Custom Search (${searchTime.toFixed(2)}s)${fallbackNote}`,
            sources: searchResult.items,
            provider: "google_custom",
          };
        }
      } catch (googleCustomError: unknown) {
        // Google Custom Search failed, log and try Gemini fallback
        console.warn(
          `Google Custom Search failed: ${getErrorMessage(googleCustomError)}`,
        );
      }
    }

    // STRATEGY 3: Tertiary fallback to Google Gemini Search (Gemini provider only)
    try {
      const response = await this.performGoogleGeminiSearch(
        this.params.query,
        signal,
      );

      const responseText = getResponseText(response as any);
      const groundingMetadata = (response as any).candidates?.[0]
        ?.groundingMetadata;
      const sources = groundingMetadata?.groundingChunks;
      const groundingSupports = groundingMetadata?.groundingSupports;

      if (!responseText || !responseText.trim()) {
        const attemptedMethods = [];
        if (tavilyApiKey) attemptedMethods.push("Tavily");
        if (googleApiKey && googleSearchEngineId)
          attemptedMethods.push("Google Custom Search");
        attemptedMethods.push("Google Gemini Search");

        return {
          llmContent: `No search results found for query: "${this.params.query}" (tried: ${attemptedMethods.join(", ")})`,
          returnDisplay: "No results found",
          provider: "google_gemini",
        };
      }

      let modifiedResponseText = responseText;
      const sourceListFormatted: string[] = [];

      if (sources && sources.length > 0) {
        sources.forEach((source: any, index: number) => {
          const title = source.web?.title || "Untitled";
          const uri = source.web?.uri || "No URI";
          sourceListFormatted.push(`[${index + 1}] ${title} (${uri})`);
        });

        if (groundingSupports && groundingSupports.length > 0) {
          const insertions: Array<{ index: number; marker: string }> = [];
          groundingSupports.forEach((support: any) => {
            if (support.segment && support.groundingChunkIndices) {
              const citationMarker = support.groundingChunkIndices
                .map((chunkIndex: number) => `[${chunkIndex + 1}]`)
                .join("");
              insertions.push({
                index: support.segment.endIndex,
                marker: citationMarker,
              });
            }
          });

          insertions.sort((a, b) => b.index - a.index);

          const encoder = new TextEncoder();
          const responseBytes = encoder.encode(modifiedResponseText);
          const parts: Uint8Array[] = [];
          let lastIndex = responseBytes.length;
          for (const ins of insertions) {
            const pos = Math.min(ins.index, lastIndex);
            parts.unshift(responseBytes.subarray(pos, lastIndex));
            parts.unshift(encoder.encode(ins.marker));
            lastIndex = pos;
          }
          parts.unshift(responseBytes.subarray(0, lastIndex));

          const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
          const finalBytes = new Uint8Array(totalLength);
          let offset = 0;
          for (const part of parts) {
            finalBytes.set(part, offset);
            offset += part.length;
          }
          modifiedResponseText = new TextDecoder().decode(finalBytes);
        }

        if (sourceListFormatted.length > 0) {
          modifiedResponseText +=
            "\n\nSources:\n" + sourceListFormatted.join("\n");
        }
      }

      const attemptedMethods = [];
      if (tavilyApiKey) attemptedMethods.push("Tavily");
      if (googleApiKey && googleSearchEngineId)
        attemptedMethods.push("Google Custom Search");
      const fallbackNote =
        attemptedMethods.length > 0
          ? ` (via Google Gemini Search - ${attemptedMethods.join(" and ")} failed)`
          : " (via Google Gemini Search)";

      return {
        llmContent: `Web search results for "${this.params.query}"${fallbackNote}:\n\n${modifiedResponseText}`,
        returnDisplay: `Search results via Google Gemini Search${attemptedMethods.length > 0 ? " (fallback)" : ""}`,
        sources,
        provider: "google_gemini",
      };
    } catch (googleGeminiError: unknown) {
      // All strategies failed - comprehensive error message
      const attemptedMethods = [];
      const errorDetails = [];

      if (tavilyApiKey) {
        attemptedMethods.push("Tavily AI");
        errorDetails.push("Tavily: failed");
      } else {
        errorDetails.push("Tavily: API key not set (TAVILY_API_KEY)");
      }

      if (googleApiKey && googleSearchEngineId) {
        attemptedMethods.push("Google Custom Search");
        errorDetails.push("Google Custom Search: failed");
      } else if (!googleSearchEngineId && googleApiKey) {
        errorDetails.push(
          "Google Custom Search: GOOGLE_SEARCH_ENGINE_ID not set",
        );
      } else if (!googleApiKey) {
        errorDetails.push("Google Custom Search: GOOGLE_API_KEY not set");
      }

      attemptedMethods.push("Google Gemini Search");
      errorDetails.push(
        `Google Gemini Search: ${getErrorMessage(googleGeminiError)}`,
      );

      const errorMessage = `All web search methods failed for query "${this.params.query}".\n${errorDetails.join("\n")}`;
      console.error(errorMessage);

      return {
        llmContent: `Error: ${errorMessage}\n\nRecommendation: Set up Tavily AI for best results with local LLMs:\n1. Get free API key at https://tavily.com (1,000 searches/month)\n2. Set TAVILY_API_KEY environment variable\n\nAlternatively, set up Google Custom Search:\n1. Enable API at https://console.cloud.google.com/apis/library/customsearch.googleapis.com\n2. Create search engine at https://programmablesearchengine.google.com/\n3. Set GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID`,
        returnDisplay: `Web search failed - tried ${attemptedMethods.length} methods`,
        error: {
          message: errorMessage,
          type: ToolErrorType.WEB_SEARCH_FAILED,
        },
      };
    }
  }
}

/**
 * A unified web search tool with three-tier automatic fallback strategy:
 *
 * 1. Tavily AI Search (primary) - Works with ALL LLM providers, AI-optimized results
 * 2. Google Custom Search API (secondary) - Works with ALL LLM providers, direct Google results
 * 3. Google Gemini Search (tertiary) - Gemini API grounding, Gemini provider only
 *
 * This ensures web search works with local LLMs (MLX, LlamaCPP, etc.) without requiring Gemini.
 */
export class UnifiedWebSearchTool extends BaseDeclarativeTool<
  UnifiedWebSearchToolParams,
  UnifiedWebSearchToolResult
> {
  static readonly Name: string = "web_search";

  constructor(private readonly config: Config) {
    super(
      UnifiedWebSearchTool.Name,
      "WebSearch",
      "Performs a web search and returns results. Uses three-tier automatic fallback: (1) Tavily AI (if TAVILY_API_KEY set - best for LLMs), (2) Google Custom Search (if GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID set - works with all LLM providers), (3) Google Gemini Search (Gemini provider only). For best results with local LLMs, set TAVILY_API_KEY (free 1,000 searches/month at https://tavily.com).",
      Kind.Search,
      {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to find information on the web.",
          },
          maxResults: {
            type: "number",
            description:
              "Maximum number of search results to return (1-20). Default: 5. Only applies when using Tavily search.",
            minimum: 1,
            maximum: 20,
            default: 5,
          },
        },
        required: ["query"],
      },
    );
  }

  /**
   * Validates the parameters for the UnifiedWebSearchTool.
   * @param params The parameters to validate
   * @returns An error message string if validation fails, null if valid
   */
  protected override validateToolParamValues(
    params: UnifiedWebSearchToolParams,
  ): string | null {
    if (!params.query || params.query.trim() === "") {
      return "The 'query' parameter cannot be empty.";
    }

    if (
      params.maxResults !== undefined &&
      (params.maxResults < 1 || params.maxResults > 20)
    ) {
      return "The 'maxResults' parameter must be between 1 and 20.";
    }

    return null;
  }

  protected createInvocation(
    params: UnifiedWebSearchToolParams,
  ): ToolInvocation<UnifiedWebSearchToolParams, UnifiedWebSearchToolResult> {
    return new UnifiedWebSearchToolInvocation(this.config, params);
  }
}
