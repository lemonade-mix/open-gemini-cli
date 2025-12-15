/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Config,
  ToolRegistry,
  ServerKaiDexStreamEvent,
} from "@google/kaidex-cli-core";
import {
  executeToolCall,
  ToolErrorType,
  shutdownTelemetry,
  KaiDexEventType,
} from "@google/kaidex-cli-core";
import type { Part } from "@google/genai";
import { runNonInteractive } from "./nonInteractiveCli.js";
import { vi } from "vitest";

// Mock core modules
vi.mock("./ui/hooks/atCommandProcessor.js");
vi.mock("@google/kaidex-cli-core", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@google/kaidex-cli-core")>();

  class MockChatRecordingService {
    initialize = vi.fn();
    recordMessage = vi.fn();
    recordMessageTokens = vi.fn();
    recordToolCalls = vi.fn();
  }

  return {
    ...original,
    executeToolCall: vi.fn(),
    shutdownTelemetry: vi.fn(),
    isTelemetrySdkInitialized: vi.fn().mockReturnValue(true),
    ChatRecordingService: MockChatRecordingService,
  };
});

describe("runNonInteractive", () => {
  let mockConfig: Config;
  let mockToolRegistry: ToolRegistry;
  let mockCoreExecuteToolCall: vi.Mock;
  let mockShutdownTelemetry: vi.Mock;
  let consoleErrorSpy: vi.SpyInstance;
  let processStdoutSpy: vi.SpyInstance;
  let mockKaiDexClient: {
    sendMessageStream: vi.Mock;
    getChatRecordingService: vi.Mock;
  };

  beforeEach(async () => {
    mockCoreExecuteToolCall = vi.mocked(executeToolCall);
    mockShutdownTelemetry = vi.mocked(shutdownTelemetry);

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processStdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    mockToolRegistry = {
      getTool: vi.fn(),
      getFunctionDeclarations: vi.fn().mockReturnValue([]),
    } as unknown as ToolRegistry;

    mockKaiDexClient = {
      sendMessageStream: vi.fn(),
      getChatRecordingService: vi.fn(() => ({
        initialize: vi.fn(),
        recordMessage: vi.fn(),
        recordMessageTokens: vi.fn(),
        recordToolCalls: vi.fn(),
      })),
    };

    mockConfig = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getKaiDexClient: vi.fn().mockReturnValue(mockKaiDexClient),
      getToolRegistry: vi.fn().mockReturnValue(mockToolRegistry),
      getMaxSessionTurns: vi.fn().mockReturnValue(10),
      getSessionId: vi.fn().mockReturnValue("test-session-id"),
      getProjectRoot: vi.fn().mockReturnValue("/test/project"),
      storage: {
        getProjectTempDir: vi.fn().mockReturnValue("/test/project/.kaidex/tmp"),
      },
      getIdeMode: vi.fn().mockReturnValue(false),
      getFullContext: vi.fn().mockReturnValue(false),
      getContentGeneratorConfig: vi.fn().mockReturnValue({}),
      getDebugMode: vi.fn().mockReturnValue(false),
    } as unknown as Config;

    const { handleAtCommand } = await import(
      "./ui/hooks/atCommandProcessor.js"
    );
    vi.mocked(handleAtCommand).mockImplementation(async ({ query }) => ({
      processedQuery: [{ text: query }],
      shouldProceed: true,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function* createStreamFromEvents(
    events: ServerKaiDexStreamEvent[],
  ): AsyncGenerator<ServerKaiDexStreamEvent> {
    for (const event of events) {
      yield event;
    }
  }

  it("should process input and write text output", async () => {
    const events: ServerKaiDexStreamEvent[] = [
      { type: KaiDexEventType.Content, value: "Hello" },
      { type: KaiDexEventType.Content, value: " World" },
      {
        type: KaiDexEventType.Finished,
        value: { reason: undefined, usageMetadata: { totalTokenCount: 10 } },
      },
    ];
    mockKaiDexClient.sendMessageStream.mockReturnValue(
      createStreamFromEvents(events),
    );

    await runNonInteractive(mockConfig, "Test input", "prompt-id-1");

    expect(mockKaiDexClient.sendMessageStream).toHaveBeenCalledWith(
      [{ text: "Test input" }],
      expect.any(AbortSignal),
      "prompt-id-1",
    );
    expect(processStdoutSpy).toHaveBeenCalledWith("Hello");
    expect(processStdoutSpy).toHaveBeenCalledWith(" World");
    expect(processStdoutSpy).toHaveBeenCalledWith("\n");
    expect(mockShutdownTelemetry).toHaveBeenCalled();
  });

  it("should handle a single tool call and respond", async () => {
    const toolCallEvent: ServerKaiDexStreamEvent = {
      type: KaiDexEventType.ToolCallRequest,
      value: {
        callId: "tool-1",
        name: "testTool",
        args: { arg1: "value1" },
        isClientInitiated: false,
        prompt_id: "prompt-id-2",
      },
    };
    const toolResponse: Part[] = [{ text: "Tool response" }];
    mockCoreExecuteToolCall.mockResolvedValue({ responseParts: toolResponse });

    const firstCallEvents: ServerKaiDexStreamEvent[] = [toolCallEvent];
    const secondCallEvents: ServerKaiDexStreamEvent[] = [
      { type: KaiDexEventType.Content, value: "Final answer" },
      {
        type: KaiDexEventType.Finished,
        value: { reason: undefined, usageMetadata: { totalTokenCount: 10 } },
      },
    ];

    mockKaiDexClient.sendMessageStream
      .mockReturnValueOnce(createStreamFromEvents(firstCallEvents))
      .mockReturnValueOnce(createStreamFromEvents(secondCallEvents));

    await runNonInteractive(mockConfig, "Use a tool", "prompt-id-2");

    expect(mockKaiDexClient.sendMessageStream).toHaveBeenCalledTimes(2);
    expect(mockCoreExecuteToolCall).toHaveBeenCalledWith(
      mockConfig,
      expect.objectContaining({ name: "testTool" }),
      expect.any(AbortSignal),
    );
    expect(mockKaiDexClient.sendMessageStream).toHaveBeenNthCalledWith(
      2,
      [{ text: "Tool response" }],
      expect.any(AbortSignal),
      "prompt-id-2",
    );
    expect(processStdoutSpy).toHaveBeenCalledWith("Final answer");
    expect(processStdoutSpy).toHaveBeenCalledWith("\n");
  });

  it("should handle error during tool execution and should send error back to the model", async () => {
    const toolCallEvent: ServerKaiDexStreamEvent = {
      type: KaiDexEventType.ToolCallRequest,
      value: {
        callId: "tool-1",
        name: "errorTool",
        args: {},
        isClientInitiated: false,
        prompt_id: "prompt-id-3",
      },
    };
    mockCoreExecuteToolCall.mockResolvedValue({
      error: new Error("Execution failed"),
      errorType: ToolErrorType.EXECUTION_FAILED,
      responseParts: [
        {
          functionResponse: {
            name: "errorTool",
            response: {
              output: "Error: Execution failed",
            },
          },
        },
      ],
      resultDisplay: "Execution failed",
    });
    const finalResponse: ServerKaiDexStreamEvent[] = [
      {
        type: KaiDexEventType.Content,
        value: "Sorry, let me try again.",
      },
      {
        type: KaiDexEventType.Finished,
        value: { reason: undefined, usageMetadata: { totalTokenCount: 10 } },
      },
    ];
    mockKaiDexClient.sendMessageStream
      .mockReturnValueOnce(createStreamFromEvents([toolCallEvent]))
      .mockReturnValueOnce(createStreamFromEvents(finalResponse));

    await runNonInteractive(mockConfig, "Trigger tool error", "prompt-id-3");

    expect(mockCoreExecuteToolCall).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error executing tool errorTool: Execution failed",
    );
    expect(mockKaiDexClient.sendMessageStream).toHaveBeenCalledTimes(2);
    expect(mockKaiDexClient.sendMessageStream).toHaveBeenNthCalledWith(
      2,
      [
        {
          functionResponse: {
            name: "errorTool",
            response: {
              output: "Error: Execution failed",
            },
          },
        },
      ],
      expect.any(AbortSignal),
      "prompt-id-3",
    );
    expect(processStdoutSpy).toHaveBeenCalledWith("Sorry, let me try again.");
  });

  it("should exit with error if sendMessageStream throws initially", async () => {
    const apiError = new Error("API connection failed");
    mockKaiDexClient.sendMessageStream.mockImplementation(() => {
      throw apiError;
    });

    await expect(
      runNonInteractive(mockConfig, "Initial fail", "prompt-id-4"),
    ).rejects.toThrow(apiError);
  });

  it("should not exit if a tool is not found, and should send error back to model", async () => {
    const toolCallEvent: ServerKaiDexStreamEvent = {
      type: KaiDexEventType.ToolCallRequest,
      value: {
        callId: "tool-1",
        name: "nonexistentTool",
        args: {},
        isClientInitiated: false,
        prompt_id: "prompt-id-5",
      },
    };
    mockCoreExecuteToolCall.mockResolvedValue({
      error: new Error('Tool "nonexistentTool" not found in registry.'),
      resultDisplay: 'Tool "nonexistentTool" not found in registry.',
      responseParts: [],
    });
    const finalResponse: ServerKaiDexStreamEvent[] = [
      {
        type: KaiDexEventType.Content,
        value: "Sorry, I can't find that tool.",
      },
      {
        type: KaiDexEventType.Finished,
        value: { reason: undefined, usageMetadata: { totalTokenCount: 10 } },
      },
    ];

    mockKaiDexClient.sendMessageStream
      .mockReturnValueOnce(createStreamFromEvents([toolCallEvent]))
      .mockReturnValueOnce(createStreamFromEvents(finalResponse));

    await runNonInteractive(
      mockConfig,
      "Trigger tool not found",
      "prompt-id-5",
    );

    expect(mockCoreExecuteToolCall).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error executing tool nonexistentTool: Tool "nonexistentTool" not found in registry.',
    );
    expect(mockKaiDexClient.sendMessageStream).toHaveBeenCalledTimes(2);
    expect(processStdoutSpy).toHaveBeenCalledWith(
      "Sorry, I can't find that tool.",
    );
  });

  it("should exit when max session turns are exceeded", async () => {
    vi.mocked(mockConfig.getMaxSessionTurns).mockReturnValue(0);
    await expect(
      runNonInteractive(mockConfig, "Trigger loop", "prompt-id-6"),
    ).rejects.toThrow(
      "Reached max session turns for this session. Increase the number of turns by specifying maxSessionTurns in settings.json.",
    );
  });

  it("should preprocess @include commands before sending to the model", async () => {
    // 1. Mock the imported atCommandProcessor
    const { handleAtCommand } = await import(
      "./ui/hooks/atCommandProcessor.js"
    );
    const mockHandleAtCommand = vi.mocked(handleAtCommand);

    // 2. Define the raw input and the expected processed output
    const rawInput = "Summarize @file.txt";
    const processedParts: Part[] = [
      { text: "Summarize @file.txt" },
      { text: "\n--- Content from referenced files ---\n" },
      { text: "This is the content of the file." },
      { text: "\n--- End of content ---" },
    ];

    // 3. Setup the mock to return the processed parts
    mockHandleAtCommand.mockResolvedValue({
      processedQuery: processedParts,
      shouldProceed: true,
    });

    // Mock a simple stream response from the KaiDex client
    const events: ServerKaiDexStreamEvent[] = [
      { type: KaiDexEventType.Content, value: "Summary complete." },
      {
        type: KaiDexEventType.Finished,
        value: { reason: undefined, usageMetadata: { totalTokenCount: 10 } },
      },
    ];
    mockKaiDexClient.sendMessageStream.mockReturnValue(
      createStreamFromEvents(events),
    );

    // 4. Run the non-interactive mode with the raw input
    await runNonInteractive(mockConfig, rawInput, "prompt-id-7");

    // 5. Assert that sendMessageStream was called with the PROCESSED parts, not the raw input
    expect(mockKaiDexClient.sendMessageStream).toHaveBeenCalledWith(
      processedParts,
      expect.any(AbortSignal),
      "prompt-id-7",
    );

    // 6. Assert the final output is correct
    expect(processStdoutSpy).toHaveBeenCalledWith("Summary complete.");
  });
});
