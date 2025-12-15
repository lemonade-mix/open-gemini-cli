import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect } from "react";
import { Box, Text } from "ink";
import { Colors } from "../colors.js";
import { RadioButtonSelect } from "../components/shared/RadioButtonSelect.js";
import { SettingScope } from "../../config/settings.js";
import { AuthType, clearCachedCredentialFile, } from "@google/kaidex-cli-core";
import { useKeypress } from "../hooks/useKeypress.js";
import { AuthState } from "../types.js";
import { runExitCleanup } from "../../utils/cleanup.js";
import { validateAuthMethodWithSettings } from "./useAuth.js";
export function AuthDialog({ config, settings, setAuthState, authError, onAuthError, }) {
    const bypassAuth = process.env["BYPASS_AUTH"] === "true";
    useEffect(() => {
        if (bypassAuth) {
            setAuthState(AuthState.Authenticated);
        }
    }, [bypassAuth, setAuthState]);
    let items = [
        {
            label: "Login with KaiDex",
            value: AuthType.LOGIN_WITH_GOOGLE,
        },
        ...(process.env["CLOUD_SHELL"] === "true"
            ? [
                {
                    label: "Use Cloud Shell user credentials",
                    value: AuthType.CLOUD_SHELL,
                },
            ]
            : []),
        {
            label: "Use KaiDex API Key",
            value: AuthType.USE_GEMINI,
        },
        { label: "Vertex AI", value: AuthType.USE_VERTEX_AI },
    ];
    if (settings.merged.security?.auth?.enforcedType) {
        items = items.filter((item) => item.value === settings.merged.security?.auth?.enforcedType);
    }
    let defaultAuthType = null;
    const defaultAuthTypeEnv = process.env["GEMINI_DEFAULT_AUTH_TYPE"];
    if (defaultAuthTypeEnv &&
        Object.values(AuthType).includes(defaultAuthTypeEnv)) {
        defaultAuthType = defaultAuthTypeEnv;
    }
    let initialAuthIndex = items.findIndex((item) => {
        if (settings.merged.security?.auth?.selectedType) {
            return item.value === settings.merged.security.auth.selectedType;
        }
        if (defaultAuthType) {
            return item.value === defaultAuthType;
        }
        if (process.env["GEMINI_API_KEY"]) {
            return item.value === AuthType.USE_GEMINI;
        }
        return item.value === AuthType.LOGIN_WITH_GOOGLE;
    });
    if (settings.merged.security?.auth?.enforcedType) {
        initialAuthIndex = 0;
    }
    const onSelect = useCallback(async (authType, scope) => {
        if (authType) {
            await clearCachedCredentialFile();
            settings.setValue(scope, "security.auth.selectedType", authType);
            if (authType === AuthType.LOGIN_WITH_GOOGLE &&
                config.isBrowserLaunchSuppressed()) {
                runExitCleanup();
                console.log(`
----------------------------------------------------------------
Logging in with KaiDex... Please restart KaiDex CLI to continue.
----------------------------------------------------------------
            `);
                process.exit(0);
            }
        }
        setAuthState(AuthState.Unauthenticated);
    }, [settings, config, setAuthState]);
    const handleAuthSelect = (authMethod) => {
        const error = validateAuthMethodWithSettings(authMethod, settings);
        if (error) {
            onAuthError(error);
        }
        else {
            onSelect(authMethod, SettingScope.User);
        }
    };
    useKeypress((key) => {
        if (key.name === "escape") {
            // Prevent exit if there is an error message.
            // This means they user is not authenticated yet.
            if (authError) {
                return;
            }
            if (settings.merged.security?.auth?.selectedType === undefined) {
                // Prevent exiting if no auth method is set
                onAuthError("You must select an auth method to proceed. Press Ctrl+C twice to exit.");
                return;
            }
            onSelect(undefined, SettingScope.User);
        }
    }, { isActive: !bypassAuth });
    if (bypassAuth) {
        return (_jsx(Text, { children: "\uD83D\uDE80 KaiDex: Authentication bypassed - ready for local LLM" }));
    }
    return (_jsxs(Box, { borderStyle: "round", borderColor: Colors.Gray, flexDirection: "column", padding: 1, width: "100%", children: [_jsx(Text, { bold: true, children: "Get started" }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { children: "How would you like to authenticate for this project?" }) }), _jsx(Box, { marginTop: 1, children: _jsx(RadioButtonSelect, { items: items, initialIndex: initialAuthIndex, onSelect: handleAuthSelect }) }), authError && (_jsx(Box, { marginTop: 1, children: _jsx(Text, { color: Colors.AccentRed, children: authError }) })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: Colors.Gray, children: "(Use Enter to select)" }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { children: "Terms of Services and Privacy Notice for KaiDex CLI" }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: Colors.AccentBlue, children: "https://limkc.com/tos" }) })] }));
}
//# sourceMappingURL=AuthDialog.js.map