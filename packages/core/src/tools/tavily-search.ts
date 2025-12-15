/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolInvocation, ToolResult } from "./tools.js";
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from "./tools.js";
import { ToolErrorType } from "./tool-error.js";
import { getErrorMessage } from "../utils/errors.js";

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
 * Parameters for the TavilySearchTool.
 */
export interface TavilySearchToolParams {
  /**
   * The search query.
   */
  query: string;

  /**
   * Maximum number of search results to return (0-20).
   * Default: 5
   */
  maxResults?: number;

  /**
   * Search depth: 'basic' (1 credit) or 'advanced' (2 credits).
   * Advanced provides more detailed content snippets.
   * Default: 'basic'
   */
  searchDepth?: "basic" | "advanced";
}

/**
 * Extends ToolResult to include sources for Tavily search.
 */
export interface TavilySearchToolResult extends ToolResult {
  sources?: TavilySearchResult[];
  answer?: string;
}

class TavilySearchToolInvocation extends BaseToolInvocation<
  TavilySearchToolParams,
  TavilySearchToolResult
> {
  constructor(params: TavilySearchToolParams) {
    super(params);
  }

  override getDescription(): string {
    const depth = this.params.searchDepth || "basic";
    const maxResults = this.params.maxResults || 5;
    return `Searching the web (Tavily ${depth}) for: "${this.params.query}" (max ${maxResults} results)`;
  }

  /**
   * Performs the Tavily search using raw fetch API
   */
  private async performTavilySearch(
    query: string,
    apiKey: string,
    maxResults: number,
    searchDepth: "basic" | "advanced",
    signal: AbortSignal,
  ): Promise<TavilySearchResponse> {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: searchDepth,
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

  async execute(signal: AbortSignal): Promise<TavilySearchToolResult> {
    try {
      // Get Tavily API key from environment or config
      const apiKey = process.env["TAVILY_API_KEY"];

      if (!apiKey) {
        return {
          llmContent: `Tavily web search is not configured. Please set TAVILY_API_KEY environment variable. Get a free API key at https://tavily.com (1,000 searches/month free).`,
          returnDisplay: "Tavily API key not configured",
          error: {
            message: "TAVILY_API_KEY environment variable not set",
            type: ToolErrorType.WEB_SEARCH_FAILED,
          },
        };
      }

      const maxResults = Math.min(Math.max(this.params.maxResults || 5, 1), 20);
      const searchDepth = this.params.searchDepth || "basic";

      const searchResult = await this.performTavilySearch(
        this.params.query,
        apiKey,
        maxResults,
        searchDepth,
        signal,
      );

      if (!searchResult.results || searchResult.results.length === 0) {
        return {
          llmContent: `No search results found for query: "${this.params.query}"`,
          returnDisplay: "No results found",
        };
      }

      // Format response for LLM
      let llmContent = "";

      // Add AI-generated answer if available
      if (searchResult.answer) {
        llmContent += `AI Summary: ${searchResult.answer}\n\n`;
      }

      llmContent += `Web search results for "${this.params.query}" (${searchResult.results.length} sources):\n\n`;

      // Add each search result with citation numbering
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

      // Add sources list at the end
      llmContent += "Sources:\n";
      searchResult.results.forEach((result, index) => {
        llmContent += `[${index + 1}] ${result.title} (${result.url})\n`;
      });

      return {
        llmContent: llmContent.trim(),
        returnDisplay: `Found ${searchResult.results.length} results (${searchDepth} search, ${searchResult.response_time.toFixed(2)}s)`,
        sources: searchResult.results,
        answer: searchResult.answer,
      };
    } catch (error: unknown) {
      const errorMessage = `Error during Tavily web search for query "${
        this.params.query
      }": ${getErrorMessage(error)}`;
      console.error(errorMessage, error);
      return {
        llmContent: `Error: ${errorMessage}\n\nTip: Verify your TAVILY_API_KEY is valid. Get a free API key at https://tavily.com`,
        returnDisplay: `Error performing web search`,
        error: {
          message: errorMessage,
          type: ToolErrorType.WEB_SEARCH_FAILED,
        },
      };
    }
  }
}

/**
 * A tool to perform web searches using Tavily AI Search API.
 * Tavily is optimized for AI/LLM use cases and works with all LLM providers
 * (MLX, LlamaCPP, OpenAI, Gemini, etc.).
 *
 * Free tier: 1,000 searches/month
 * API Key: https://tavily.com
 */
export class TavilySearchTool extends BaseDeclarativeTool<
  TavilySearchToolParams,
  TavilySearchToolResult
> {
  static readonly Name: string = "tavily_web_search";

  constructor() {
    super(
      TavilySearchTool.Name,
      "TavilySearch",
      "Performs a web search using Tavily AI Search API (optimized for LLMs, works with all providers including local MLX/LlamaCPP). Returns AI-curated results with relevance scores and optional AI-generated summary. Requires TAVILY_API_KEY environment variable (free tier: 1,000 searches/month at https://tavily.com).",
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
              "Maximum number of search results to return (1-20). Default: 5. Use 5 for quick searches, 10 for comprehensive research.",
            minimum: 1,
            maximum: 20,
            default: 5,
          },
          searchDepth: {
            type: "string",
            enum: ["basic", "advanced"],
            description:
              "Search depth: 'basic' (faster, 1 API credit) or 'advanced' (more detailed snippets, 2 API credits). Default: 'basic'.",
            default: "basic",
          },
        },
        required: ["query"],
      },
    );
  }

  /**
   * Validates the parameters for the TavilySearchTool.
   * @param params The parameters to validate
   * @returns An error message string if validation fails, null if valid
   */
  protected override validateToolParamValues(
    params: TavilySearchToolParams,
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

    if (
      params.searchDepth !== undefined &&
      params.searchDepth !== "basic" &&
      params.searchDepth !== "advanced"
    ) {
      return "The 'searchDepth' parameter must be either 'basic' or 'advanced'.";
    }

    return null;
  }

  protected createInvocation(
    params: TavilySearchToolParams,
  ): ToolInvocation<TavilySearchToolParams, TavilySearchToolResult> {
    return new TavilySearchToolInvocation(params);
  }
}
