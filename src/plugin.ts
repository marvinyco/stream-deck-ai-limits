import streamDeck from "@elgato/streamdeck";
import { ProgressBars } from "./actions/progress-bars";
import { ClaudeProfilesAction } from "./actions/claude-profiles";
import { CodexProgressBars } from "./actions/codex-progress-bars";
import { AntigravityProgressBars } from "./actions/antigravity-progress-bars";
import { GeminiCliProgressBars } from "./actions/gemini-cli-progress-bars";
import { MiniMaxProgressBars } from "./actions/minimax-progress-bars";
import { OpenRouterProgressBars } from "./actions/openrouter-progress-bars";
import { CodexBarProgressBars } from "./actions/codexbar-progress-bars";
import { RefreshInterval } from "./services/refresh-interval";

streamDeck.actions.registerAction(new ProgressBars());
streamDeck.actions.registerAction(new ClaudeProfilesAction());
streamDeck.actions.registerAction(new CodexProgressBars());
streamDeck.actions.registerAction(new AntigravityProgressBars());
streamDeck.actions.registerAction(new GeminiCliProgressBars());
streamDeck.actions.registerAction(new MiniMaxProgressBars());
streamDeck.actions.registerAction(new OpenRouterProgressBars());
streamDeck.actions.registerAction(new CodexBarProgressBars());

const refreshInterval = RefreshInterval.getInstance();
refreshInterval.listen();

streamDeck.connect().then(() => refreshInterval.load()).catch((err) => {
    streamDeck.logger.error(`Failed to load refresh interval: ${err}`);
});
