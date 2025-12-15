/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { OAuth2Client, Compute, CodeChallengeMethod, } from "google-auth-library";
import * as http from "node:http";
import url from "node:url";
import crypto from "node:crypto";
import * as net from "node:net";
import open from "open";
import path from "node:path";
import { promises as fs } from "node:fs";
import { getErrorMessage, FatalAuthenticationError } from "../utils/errors.js";
import { UserAccountManager } from "../utils/userAccountManager.js";
import { AuthType } from "../core/contentGenerator.js";
import readline from "node:readline";
import { Storage } from "../config/storage.js";
const userAccountManager = new UserAccountManager();
// KaiDex: Bypass authentication if flag is set
if (process.env["BYPASS_AUTH"] === "true") {
}
//  OAuth Client ID used to initiate OAuth2Client class.
const OAUTH_CLIENT_ID = "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com";
// OAuth Secret value used to initiate OAuth2Client class.
// Note: It's ok to save this in git because this is an installed application
// as described here: https://developers.google.com/identity/protocols/oauth2#installed
// "The process results in a client ID and, in some cases, a client secret,
// which you embed in the source code of your application. (In this context,
// the client secret is obviously not treated as a secret.)"
const OAUTH_CLIENT_SECRET = "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";
// OAuth Scopes for Cloud Code authorization.
const OAUTH_SCOPE = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
];
const HTTP_REDIRECT = 301;
const SIGN_IN_SUCCESS_URL = "https://developers.google.com/gemini-code-assist/auth_success_gemini";
const SIGN_IN_FAILURE_URL = "https://developers.google.com/gemini-code-assist/auth_failure_gemini";
const oauthClientPromises = new Map();
async function initOauthClient(authType, config) {
    const client = new OAuth2Client({
        clientId: OAUTH_CLIENT_ID,
        clientSecret: OAUTH_CLIENT_SECRET,
        transporterOptions: {
            proxy: config.getProxy(),
        },
    });
    if (process.env["GOOGLE_GENAI_USE_GCA"] &&
        process.env["GOOGLE_CLOUD_ACCESS_TOKEN"]) {
        client.setCredentials({
            access_token: process.env["GOOGLE_CLOUD_ACCESS_TOKEN"],
        });
        await fetchAndCacheUserInfo(client);
        return client;
    }
    client.on("tokens", async (tokens) => {
        await cacheCredentials(tokens);
    });
    // If there are cached creds on disk, they always take precedence
    if (await loadCachedCredentials(client)) {
        // Found valid cached credentials.
        // Check if we need to retrieve Google Account ID or Email
        if (!userAccountManager.getCachedGoogleAccount()) {
            try {
                await fetchAndCacheUserInfo(client);
            }
            catch (error) {
                // Non-fatal, continue with existing auth.
                console.warn("Failed to fetch user info:", getErrorMessage(error));
            }
        }
        console.log("Loaded cached credentials.");
        return client;
    }
    // In Google Cloud Shell, we can use Application Default Credentials (ADC)
    // provided via its metadata server to authenticate non-interactively using
    // the identity of the user logged into Cloud Shell.
    if (authType === AuthType.CLOUD_SHELL) {
        try {
            console.log("Attempting to authenticate via Cloud Shell VM's ADC.");
            const computeClient = new Compute({
            // We can leave this empty, since the metadata server will provide
            // the service account email.
            });
            await computeClient.getAccessToken();
            console.log("Authentication successful.");
            // Do not cache creds in this case; note that Compute client will handle its own refresh
            return computeClient;
        }
        catch (e) {
            throw new Error(`Could not authenticate using Cloud Shell credentials. Please select a different authentication method or ensure you are in a properly configured environment. Error: ${getErrorMessage(e)}`);
        }
    }
    if (config.isBrowserLaunchSuppressed()) {
        let success = false;
        const maxRetries = 2;
        for (let i = 0; !success && i < maxRetries; i++) {
            success = await authWithUserCode(client);
            if (!success) {
                console.error("\nFailed to authenticate with user code.", i === maxRetries - 1 ? "" : "Retrying...\n");
            }
        }
        if (!success) {
            throw new FatalAuthenticationError("Failed to authenticate with user code.");
        }
    }
    else {
        // KaiDex: Use limkc.com auth instead of Google
        const webLogin = await authWithLimkc();
        console.log(`\n\nKaiDex login required.\n` +
            `Attempting to open authentication page in your browser.\n` +
            `Otherwise navigate to:\n\n${webLogin.authUrl}\n\n`);
        try {
            const childProcess = await open(webLogin.authUrl);
            childProcess.on("error", (error) => {
                console.error("Failed to open browser automatically. Please try running again with NO_BROWSER=true set.");
                console.error("Browser error details:", getErrorMessage(error));
            });
        }
        catch (err) {
            console.error("An unexpected error occurred while trying to open the browser:", getErrorMessage(err), "\nThis might be due to browser compatibility issues or system configuration.", "\nPlease try running again with NO_BROWSER=true set for manual authentication.");
            throw new FatalAuthenticationError(`Failed to open browser: ${getErrorMessage(err)}`);
        }
        console.log("Waiting for authentication...");
        const authTimeout = 5 * 60 * 1000; // 5 minutes timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new FatalAuthenticationError("Authentication timed out after 5 minutes. The browser tab may have gotten stuck in a loading state. " +
                    "Please try again or use NO_BROWSER=true for manual authentication."));
            }, authTimeout);
        });
        await Promise.race([webLogin.loginCompletePromise, timeoutPromise]);
        // After successful limkc.com auth, set the token on the OAuth client
        const cachedCreds = await fs.readFile(Storage.getOAuthCredsPath(), "utf-8");
        client.setCredentials(JSON.parse(cachedCreds));
    }
    return client;
}
export async function getOauthClient(authType, config) {
    if (!oauthClientPromises.has(authType)) {
        oauthClientPromises.set(authType, initOauthClient(authType, config));
    }
    return oauthClientPromises.get(authType);
}
async function authWithUserCode(client) {
    const redirectUri = "https://codeassist.google.com/authcode";
    const codeVerifier = await client.generateCodeVerifierAsync();
    const state = crypto.randomBytes(32).toString("hex");
    const authUrl = client.generateAuthUrl({
        redirect_uri: redirectUri,
        access_type: "offline",
        scope: OAUTH_SCOPE,
        code_challenge_method: CodeChallengeMethod.S256,
        code_challenge: codeVerifier.codeChallenge,
        state,
    });
    console.log("Please visit the following URL to authorize the application:");
    console.log("");
    console.log(authUrl);
    console.log("");
    const code = await new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question("Enter the authorization code: ", (code) => {
            rl.close();
            resolve(code.trim());
        });
    });
    if (!code) {
        console.error("Authorization code is required.");
        return false;
    }
    try {
        const { tokens } = await client.getToken({
            code,
            codeVerifier: codeVerifier.codeVerifier,
            redirect_uri: redirectUri,
        });
        client.setCredentials(tokens);
    }
    catch (error) {
        console.error("Failed to authenticate with authorization code:", getErrorMessage(error));
        return false;
    }
    return true;
}
// KaiDex: Custom auth with limkc.com
async function authWithLimkc() {
    const port = await getAvailablePort();
    const host = process.env["OAUTH_CALLBACK_HOST"] || "localhost";
    const redirectUri = `http://localhost:${port}/callback`;
    const state = crypto.randomBytes(32).toString("hex");
    // Redirect to limkc.com login page
    const authUrl = `https://limkc.com/login?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    const loginCompletePromise = new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            try {
                if (req.url.indexOf("/callback") === -1) {
                    res.writeHead(HTTP_REDIRECT, { Location: SIGN_IN_FAILURE_URL });
                    res.end();
                    reject(new FatalAuthenticationError("Callback not received. Unexpected request: " + req.url));
                }
                const qs = new url.URL(req.url, "http://localhost:3000").searchParams;
                if (qs.get("error")) {
                    res.writeHead(HTTP_REDIRECT, { Location: SIGN_IN_FAILURE_URL });
                    res.end();
                    const errorCode = qs.get("error");
                    const errorDescription = qs.get("error_description") || "No additional details provided";
                    reject(new FatalAuthenticationError(`Login error: ${errorCode}. ${errorDescription}`));
                }
                else if (qs.get("state") !== state) {
                    res.end("State mismatch. Possible CSRF attack");
                    reject(new FatalAuthenticationError("State mismatch. Possible CSRF attack or browser session issue."));
                }
                else if (qs.get("token")) {
                    try {
                        const token = qs.get("token");
                        // Store token in credentials format
                        const credentials = {
                            access_token: token,
                            token_type: "Bearer",
                        };
                        await cacheCredentials(credentials);
                        res.writeHead(HTTP_REDIRECT, { Location: SIGN_IN_SUCCESS_URL });
                        res.end();
                        resolve();
                    }
                    catch (error) {
                        res.writeHead(HTTP_REDIRECT, { Location: SIGN_IN_FAILURE_URL });
                        res.end();
                        reject(new FatalAuthenticationError(`Failed to save token: ${getErrorMessage(error)}`));
                    }
                }
                else {
                    reject(new FatalAuthenticationError("No token received. Please try authenticating again."));
                }
            }
            catch (e) {
                if (e instanceof FatalAuthenticationError) {
                    reject(e);
                }
                else {
                    reject(new FatalAuthenticationError(`Unexpected error during authentication: ${getErrorMessage(e)}`));
                }
            }
            finally {
                server.close();
            }
        });
        server.listen(port, host, () => {
            // Server started successfully
        });
        server.on("error", (err) => {
            reject(new FatalAuthenticationError(`Callback server error: ${getErrorMessage(err)}`));
        });
    });
    return {
        authUrl,
        loginCompletePromise,
    };
}
// KaiDex: Removed Google OAuth - now using limkc.com auth via authWithLimkc()
// Original authWithWeb function removed to avoid unused code warnings
export function getAvailablePort() {
    return new Promise((resolve, reject) => {
        let port = 0;
        try {
            const portStr = process.env["OAUTH_CALLBACK_PORT"];
            if (portStr) {
                port = parseInt(portStr, 10);
                if (isNaN(port) || port <= 0 || port > 65535) {
                    return reject(new Error(`Invalid value for OAUTH_CALLBACK_PORT: "${portStr}"`));
                }
                return resolve(port);
            }
            const server = net.createServer();
            server.listen(0, () => {
                const address = server.address();
                port = address.port;
            });
            server.on("listening", () => {
                server.close();
                server.unref();
            });
            server.on("error", (e) => reject(e));
            server.on("close", () => resolve(port));
        }
        catch (e) {
            reject(e);
        }
    });
}
async function loadCachedCredentials(client) {
    const pathsToTry = [
        Storage.getOAuthCredsPath(),
        process.env["GOOGLE_APPLICATION_CREDENTIALS"],
    ].filter((p) => !!p);
    for (const keyFile of pathsToTry) {
        try {
            const creds = await fs.readFile(keyFile, "utf-8");
            client.setCredentials(JSON.parse(creds));
            // This will verify locally that the credentials look good.
            const { token } = await client.getAccessToken();
            if (!token) {
                continue;
            }
            // This will check with the server to see if it hasn't been revoked.
            await client.getTokenInfo(token);
            return true;
        }
        catch (error) {
            // Log specific error for debugging, but continue trying other paths
            console.debug(`Failed to load credentials from ${keyFile}:`, getErrorMessage(error));
        }
    }
    return false;
}
async function cacheCredentials(credentials) {
    const filePath = Storage.getOAuthCredsPath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const credString = JSON.stringify(credentials, null, 2);
    await fs.writeFile(filePath, credString, { mode: 0o600 });
    try {
        await fs.chmod(filePath, 0o600);
    }
    catch {
        /* empty */
    }
}
export function clearOauthClientCache() {
    oauthClientPromises.clear();
}
export async function clearCachedCredentialFile() {
    try {
        await fs.rm(Storage.getOAuthCredsPath(), { force: true });
        // Clear the Google Account ID cache when credentials are cleared
        await userAccountManager.clearCachedGoogleAccount();
        // Clear the in-memory OAuth client cache to force re-authentication
        clearOauthClientCache();
    }
    catch (e) {
        console.error("Failed to clear cached credentials:", e);
    }
}
async function fetchAndCacheUserInfo(client) {
    try {
        const { token } = await client.getAccessToken();
        if (!token) {
            return;
        }
        const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!response.ok) {
            console.error("Failed to fetch user info:", response.status, response.statusText);
            return;
        }
        const userInfo = await response.json();
        await userAccountManager.cacheGoogleAccount(userInfo.email);
    }
    catch (error) {
        console.error("Error retrieving user info:", error);
    }
}
// Helper to ensure test isolation
export function resetOauthClientForTesting() {
    oauthClientPromises.clear();
}
//# sourceMappingURL=oauth2.js.map