import type { ModelUsage, StandardUsageResult } from "@lenadweb/ai-limits";
import type { ClaudeProfilesSettings } from "../interfaces/settings";
import type { ProfileBar, ProfileGroup } from "../ui/progress-bar-renderer";

// Type-only imports keep this module loadable by `node --test` without a build.

export const DEFAULT_PROFILE_LABELS = ["WORK", "PERSONAL"] as const;

/** Bucket keys vary per Claude plan/API version, as in the Claude (Native) action. */
const SESSION_KEYS = ["five_hour", "5h_quota"];
const WEEKLY_KEYS = ["seven_day", "7d_quota"];

export interface ResolvedProfile {
    label: string;
    credentialsPath: string;
}

/** Where the plugin runs, and the credentials file the default Claude login reads. */
export interface PathEnv {
    platform: string;
    defaultPath: string;
}

/**
 * Windows paths ignore case and accept either slash, and both WSL share names reach
 * the same distro, so every spelling of one file must map to one provider.
 */
function canonicalPath(path: string, platform: string): string {
    if (platform !== "win32") return path;
    return path.replace(/\//g, "\\").toLowerCase().replace(/^\\\\wsl\.localhost\\/, "\\\\wsl$\\");
}

/**
 * Windows "Copy as path" wraps the path in quotes; the file name itself never has them.
 * A path to the default login's file becomes empty, so it shares the default provider
 * instead of refreshing the same token from a second one.
 */
export function normalizePath(path: string | undefined, env?: PathEnv): string {
    const bare = (path ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
    if (!bare || !env) return bare;
    const canonical = canonicalPath(bare, env.platform);
    // On macOS the default login is the keychain, so a file there is a different store.
    if (env.platform !== "darwin" && canonical === canonicalPath(env.defaultPath, env.platform)) return "";
    return canonical;
}

export function resolveProfiles(settings: ClaudeProfilesSettings | undefined, env?: PathEnv): [ResolvedProfile, ResolvedProfile] {
    const profile = (i: 0 | 1): ResolvedProfile => {
        const configured = settings?.profiles?.[i];
        return {
            label: configured?.label?.trim() || DEFAULT_PROFILE_LABELS[i],
            credentialsPath: normalizePath(configured?.credentialsPath, env)
        };
    };
    return [profile(0), profile(1)];
}

/** Tiles pointing at the same two files share one fetch; labels are presentation only. */
export function profilesFetchKey(settings: ClaudeProfilesSettings | undefined, env?: PathEnv): string {
    return resolveProfiles(settings, env).map((profile) => profile.credentialsPath).join("|");
}

/**
 * A profile whose fetch threw still needs a result, so the other profile keeps
 * drawing and this one shows why it has no bars.
 */
export function settleProfiles(
    settled: PromiseSettledResult<StandardUsageResult>[],
    provider: StandardUsageResult["provider"]
): [StandardUsageResult, StandardUsageResult] {
    const one = (outcome: PromiseSettledResult<StandardUsageResult> | undefined): StandardUsageResult =>
        outcome?.status === "fulfilled"
            ? outcome.value
            : {
                provider,
                overallUsagePercent: null,
                overallResetTime: null,
                error: { code: "API", message: reasonMessage(outcome?.reason) }
            };
    return [one(settled[0]), one(settled[1])];
}

export function toProfileGroups(
    profiles: StandardUsageResult[],
    settings: ClaudeProfilesSettings | undefined,
    formatReset: (resetTime: string) => string
): ProfileGroup[] {
    return resolveProfiles(settings).map(({ label }, i) => {
        const result = profiles[i];
        if (!result) return { label, error: "No Data" };
        if (result.error) return { label, error: result.error.message || "Error" };
        return { label, bars: [bar(result, SESSION_KEYS, formatReset), bar(result, WEEKLY_KEYS, formatReset)] };
    });
}

function bar(result: StandardUsageResult, keys: string[], formatReset: (resetTime: string) => string): ProfileBar {
    const bucket: ModelUsage | undefined = keys.map((key) => result.perModel?.[key]).find(Boolean);
    if (!bucket || bucket.usagePercent == null) return { empty: true };
    return { percent: bucket.usagePercent, caption: bucket.resetTime ? formatReset(bucket.resetTime) : undefined };
}

function reasonMessage(reason: unknown): string {
    if (reason instanceof Error && reason.message) return reason.message;
    return reason ? String(reason) : "Fetch Failed";
}
