/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {} from "react";
export var AuthState;
(function (AuthState) {
    // Attemtping to authenticate or re-authenticate
    AuthState["Unauthenticated"] = "unauthenticated";
    // Auth dialog is open for user to select auth method
    AuthState["Updating"] = "updating";
    // Successfully authenticated
    AuthState["Authenticated"] = "authenticated";
})(AuthState || (AuthState = {}));
// Only defining the state enum needed by the UI
export var StreamingState;
(function (StreamingState) {
    StreamingState["Idle"] = "idle";
    StreamingState["Responding"] = "responding";
    StreamingState["WaitingForConfirmation"] = "waiting_for_confirmation";
})(StreamingState || (StreamingState = {}));
// Copied from server/src/core/turn.ts for CLI usage
export var KaiDexEventType;
(function (KaiDexEventType) {
    KaiDexEventType["Content"] = "content";
    KaiDexEventType["ToolCallRequest"] = "tool_call_request";
    // Add other event types if the UI hook needs to handle them
})(KaiDexEventType || (KaiDexEventType = {}));
export var ToolCallStatus;
(function (ToolCallStatus) {
    ToolCallStatus["Pending"] = "Pending";
    ToolCallStatus["Canceled"] = "Canceled";
    ToolCallStatus["Confirming"] = "Confirming";
    ToolCallStatus["Executing"] = "Executing";
    ToolCallStatus["Success"] = "Success";
    ToolCallStatus["Error"] = "Error";
})(ToolCallStatus || (ToolCallStatus = {}));
// Message types used by internal command feedback (subset of HistoryItem types)
export var MessageType;
(function (MessageType) {
    MessageType["INFO"] = "info";
    MessageType["ERROR"] = "error";
    MessageType["USER"] = "user";
    MessageType["ABOUT"] = "about";
    MessageType["HELP"] = "help";
    MessageType["STATS"] = "stats";
    MessageType["MODEL_STATS"] = "model_stats";
    MessageType["TOOL_STATS"] = "tool_stats";
    MessageType["QUIT"] = "quit";
    MessageType["GEMINI"] = "gemini";
    MessageType["COMPRESSION"] = "compression";
})(MessageType || (MessageType = {}));
//# sourceMappingURL=types.js.map