/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { homedir } from "node:os";
import * as dotenv from "dotenv";
import { AuthType, Config, FileDiscoveryService, ApprovalMode, loadServerHierarchicalMemory, GEMINI_CONFIG_DIR, DEFAULT_KAIDEX_EMBEDDING_MODEL, DEFAULT_KAIDEX_MODEL, } from "@google/kaidex-cli-core";
import { logger } from "../utils/logger.js";
import { CoderAgentEvent } from "../types.js";
export async function loadConfig(settings, extensions, taskId) {
    const mcpServers = mergeMcpServers(settings, extensions);
    const workspaceDir = process.cwd();
    const adcFilePath = process.env["GOOGLE_APPLICATION_CREDENTIALS"];
    const configParams = {
        sessionId: taskId,
        model: DEFAULT_KAIDEX_MODEL,
        embeddingModel: DEFAULT_KAIDEX_EMBEDDING_MODEL,
        sandbox: undefined, // Sandbox might not be relevant for a server-side agent
        targetDir: workspaceDir, // Or a specific directory the agent operates on
        debugMode: process.env["DEBUG"] === "true" || false,
        question: "", // Not used in server mode directly like CLI
        fullContext: false, // Server might have different context needs
        coreTools: settings.coreTools || undefined,
        excludeTools: settings.excludeTools || undefined,
        showMemoryUsage: settings.showMemoryUsage || false,
        approvalMode: process.env["GEMINI_YOLO_MODE"] === "true"
            ? ApprovalMode.YOLO
            : ApprovalMode.DEFAULT,
        mcpServers,
        cwd: workspaceDir,
        telemetry: {
            enabled: settings.telemetry?.enabled,
            target: settings.telemetry?.target,
            otlpEndpoint: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] ??
                settings.telemetry?.otlpEndpoint,
            logPrompts: settings.telemetry?.logPrompts,
        },
        // Git-aware file filtering settings
        fileFiltering: {
            respectGitIgnore: settings.fileFiltering?.respectGitIgnore,
            enableRecursiveFileSearch: settings.fileFiltering?.enableRecursiveFileSearch,
        },
        ideMode: false,
    };
    const fileService = new FileDiscoveryService(workspaceDir);
    const extensionContextFilePaths = extensions.flatMap((e) => e.contextFiles);
    const { memoryContent, fileCount } = await loadServerHierarchicalMemory(workspaceDir, [workspaceDir], false, fileService, extensionContextFilePaths, true);
    configParams.userMemory = memoryContent;
    configParams.geminiMdFileCount = fileCount;
    const config = new Config({
        ...configParams,
    });
    // Needed to initialize ToolRegistry, and git checkpointing if enabled
    await config.initialize();
    if (process.env["USE_CCPA"]) {
        logger.info("[Config] Using CCPA Auth:");
        try {
            if (adcFilePath) {
                path.resolve(adcFilePath);
            }
        }
        catch (e) {
            logger.error(`[Config] USE_CCPA env var is true but unable to resolve GOOGLE_APPLICATION_CREDENTIALS file path ${adcFilePath}. Error ${e}`);
        }
        await config.refreshAuth(AuthType.LOGIN_WITH_GOOGLE);
        logger.info(`[Config] GOOGLE_CLOUD_PROJECT: ${process.env["GOOGLE_CLOUD_PROJECT"]}`);
    }
    else if (process.env["GEMINI_API_KEY"]) {
        logger.info("[Config] Using KaiDex API Key");
        await config.refreshAuth(AuthType.USE_GEMINI);
    }
    else {
        logger.error(`[Config] Unable to set GeneratorConfig. Please provide a GEMINI_API_KEY or set USE_CCPA.`);
    }
    return config;
}
export function mergeMcpServers(settings, extensions) {
    const mcpServers = { ...(settings.mcpServers || {}) };
    for (const extension of extensions) {
        Object.entries(extension.config.mcpServers || {}).forEach(([key, server]) => {
            if (mcpServers[key]) {
                console.warn(`Skipping extension MCP config for server with key "${key}" as it already exists.`);
                return;
            }
            mcpServers[key] = server;
        });
    }
    return mcpServers;
}
export function setTargetDir(agentSettings) {
    const originalCWD = process.cwd();
    const targetDir = process.env["CODER_AGENT_WORKSPACE_PATH"] ??
        (agentSettings?.kind === CoderAgentEvent.StateAgentSettingsEvent
            ? agentSettings.workspacePath
            : undefined);
    if (!targetDir) {
        return originalCWD;
    }
    logger.info(`[CoderAgentExecutor] Overriding workspace path to: ${targetDir}`);
    try {
        const resolvedPath = path.resolve(targetDir);
        process.chdir(resolvedPath);
        return resolvedPath;
    }
    catch (e) {
        logger.error(`[CoderAgentExecutor] Error resolving workspace path: ${e}, returning original os.cwd()`);
        return originalCWD;
    }
}
export function loadEnvironment() {
    const envFilePath = findEnvFile(process.cwd());
    if (envFilePath) {
        dotenv.config({ path: envFilePath, override: true });
    }
}
function findEnvFile(startDir) {
    let currentDir = path.resolve(startDir);
    while (true) {
        // prefer gemini-specific .env under GEMINI_DIR
        const geminiEnvPath = path.join(currentDir, GEMINI_CONFIG_DIR, ".env");
        if (fs.existsSync(geminiEnvPath)) {
            return geminiEnvPath;
        }
        const privateEnvPath = path.join(currentDir, "PRIVATE", ".env");
        if (fs.existsSync(privateEnvPath)) {
            return privateEnvPath;
        }
        const envPath = path.join(currentDir, ".env");
        if (fs.existsSync(envPath)) {
            return envPath;
        }
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir || !parentDir) {
            // check .env under home as fallback, again preferring gemini-specific .env
            const homeGeminiEnvPath = path.join(process.cwd(), GEMINI_CONFIG_DIR, ".env");
            if (fs.existsSync(homeGeminiEnvPath)) {
                return homeGeminiEnvPath;
            }
            const homePrivateEnvPath = path.join(homedir(), "PRIVATE", ".env");
            if (fs.existsSync(homePrivateEnvPath)) {
                return homePrivateEnvPath;
            }
            const homeEnvPath = path.join(homedir(), ".env");
            if (fs.existsSync(homeEnvPath)) {
                return homeEnvPath;
            }
            return null;
        }
        currentDir = parentDir;
    }
}
//# sourceMappingURL=config.js.map