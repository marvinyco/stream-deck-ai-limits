import { action } from "@elgato/streamdeck";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { ClaudeProvider, ProviderName, StandardUsageResult } from "@lenadweb/ai-limits";
import { ClaudeProfilesSettings } from "../interfaces/settings";
import { ServiceTheme } from "../interfaces/theme";
import { LimitsManager, streamDeckLogger } from "../services/limits-manager";
import { PathEnv, profilesFetchKey, resolveProfiles, settleProfiles, toProfileGroups } from "../utils/claude-profiles";
import { formatTimeUntil } from "../utils/time-formatter";
import { BaseMonitoringAction } from "./base-monitoring-action";

interface ClaudeProfilesResult {
    profiles: [StandardUsageResult, StandardUsageResult];
    /** Always null: a failing profile is drawn inside its own group, not over the tile. */
    error: null;
}

/**
 * One provider per credentials file, shared by every tile that points at it, so each
 * account keeps its own token refresh, backoff and usage cache. Two providers on one
 * file would each rotate its refresh token and log the other out.
 */
const providers = new Map<string, ClaudeProvider>();

/** The file the library's default Claude login reads, resolved the same way it does. */
const pathEnv: PathEnv = {
    platform: platform(),
    defaultPath: join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), ".credentials.json")
};

function providerFor(credentialsPath: string): ClaudeProvider {
    // The default login is the one Claude (Native) already holds a provider for.
    if (!credentialsPath) {
        return LimitsManager.getInstance().getClient().getProvider<ClaudeProvider>(ProviderName.Claude);
    }
    let provider = providers.get(credentialsPath);
    if (!provider) {
        provider = new ClaudeProvider({ credentialsPath, useKeychain: false }).setLogger(streamDeckLogger);
        providers.set(credentialsPath, provider);
    }
    return provider;
}

@action({ UUID: "com.len.limits.claude.profiles" })
export class ClaudeProfilesAction extends BaseMonitoringAction<ClaudeProfilesSettings, ClaudeProfilesResult> {
    protected readonly providerName = ProviderName.Claude;
    protected readonly themeName: ServiceTheme = "claude";

    protected override fetchKey(settings: ClaudeProfilesSettings | undefined): string {
        return profilesFetchKey(settings, pathEnv);
    }

    protected override async fetchProviderUsage(ev: any): Promise<ClaudeProfilesResult> {
        const profiles = resolveProfiles(ev?.payload?.settings, pathEnv);
        const settled = await Promise.allSettled(profiles.map((profile) => providerFor(profile.credentialsPath).fetchUsage()));
        return { profiles: settleProfiles(settled, ProviderName.Claude), error: null };
    }

    /** Unused: {@link draw} renders the profile groups itself. */
    protected getDisplayData() {
        return {};
    }

    protected override async draw(ev: any, result: ClaudeProfilesResult): Promise<void> {
        const groups = toProfileGroups(result.profiles, ev?.payload?.settings, formatTimeUntil);
        const key = this.renderer.renderProfiles(groups, this.themeName, 144, 144);
        await ev.action.setImage(`data:image/svg+xml;base64,${Buffer.from(key).toString("base64")}`);
        await this.updateDialFeedback(ev, this.renderer.renderProfiles(groups, this.themeName, 200, 100));
    }
}
