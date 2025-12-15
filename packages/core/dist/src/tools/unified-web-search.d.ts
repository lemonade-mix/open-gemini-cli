/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ToolInvocation, ToolResult } from "./tools.js";
import { BaseDeclarativeTool } from "./tools.js";
import type { Config } from "../config/config.js";
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
 * Google Custom Search result item
 */
interface GoogleCustomSearchItem {
    title: string;
    link: string;
    snippet: string;
    displayLink?: string;
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
/**
 * A unified web search tool with three-tier automatic fallback strategy:
 *
 * 1. Tavily AI Search (primary) - Works with ALL LLM providers, AI-optimized results
 * 2. Google Custom Search API (secondary) - Works with ALL LLM providers, direct Google results
 * 3. Google Gemini Search (tertiary) - Gemini API grounding, Gemini provider only
 *
 * This ensures web search works with local LLMs (MLX, LlamaCPP, etc.) without requiring Gemini.
 */
export declare class UnifiedWebSearchTool extends BaseDeclarativeTool<UnifiedWebSearchToolParams, UnifiedWebSearchToolResult> {
    private readonly config;
    static readonly Name: string;
    constructor(config: Config);
    /**
     * Validates the parameters for the UnifiedWebSearchTool.
     * @param params The parameters to validate
     * @returns An error message string if validation fails, null if valid
     */
    protected validateToolParamValues(params: UnifiedWebSearchToolParams): string | null;
    protected createInvocation(params: UnifiedWebSearchToolParams): ToolInvocation<UnifiedWebSearchToolParams, UnifiedWebSearchToolResult>;
}
export {};
