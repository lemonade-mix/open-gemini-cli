/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ToolInvocation, ToolResult } from "./tools.js";
import { BaseDeclarativeTool } from "./tools.js";
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
/**
 * A tool to perform web searches using Tavily AI Search API.
 * Tavily is optimized for AI/LLM use cases and works with all LLM providers
 * (MLX, LlamaCPP, OpenAI, Gemini, etc.).
 *
 * Free tier: 1,000 searches/month
 * API Key: https://tavily.com
 */
export declare class TavilySearchTool extends BaseDeclarativeTool<TavilySearchToolParams, TavilySearchToolResult> {
    static readonly Name: string;
    constructor();
    /**
     * Validates the parameters for the TavilySearchTool.
     * @param params The parameters to validate
     * @returns An error message string if validation fails, null if valid
     */
    protected validateToolParamValues(params: TavilySearchToolParams): string | null;
    protected createInvocation(params: TavilySearchToolParams): ToolInvocation<TavilySearchToolParams, TavilySearchToolResult>;
}
export {};
