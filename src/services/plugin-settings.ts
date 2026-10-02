import streamDeck from "@elgato/streamdeck";
import { DEFAULT_REFRESH_MINUTES, refreshIntervalMinutes } from "../utils/refresh-interval";
import { ResetDisplay, resetDisplayMode, setResetDisplay } from "../utils/time-formatter";

interface PluginGlobalSettings {
    refreshIntervalMinutes?: number;
    resetDisplay?: ResetDisplay;
    [key: string]: any;
}

type Listener = () => void;

/**
 * Plugin-wide preferences, kept in global settings so one control on any settings
 * page applies to every action: the refresh interval and how reset times read.
 */
export class PluginSettings {
    private static instance: PluginSettings | null = null;
    private minutes = DEFAULT_REFRESH_MINUTES;
    private display: ResetDisplay = "remaining";
    private readonly intervalListeners = new Set<Listener>();
    private readonly displayListeners = new Set<Listener>();

    static getInstance(): PluginSettings {
        if (!PluginSettings.instance) {
            PluginSettings.instance = new PluginSettings();
        }
        return PluginSettings.instance;
    }

    get refreshIntervalMs(): number {
        return this.minutes * 60_000;
    }

    /** Register before connecting so the first global settings event is not missed. */
    listen(): void {
        streamDeck.settings.onDidReceiveGlobalSettings<PluginGlobalSettings>((ev) => {
            this.apply(ev.settings ?? {});
        });
    }

    async load(): Promise<void> {
        const global = await streamDeck.settings.getGlobalSettings<PluginGlobalSettings>();
        this.apply(global ?? {});
    }

    onRefreshIntervalChange(listener: Listener): void {
        this.intervalListeners.add(listener);
    }

    onResetDisplayChange(listener: Listener): void {
        this.displayListeners.add(listener);
    }

    private apply(settings: PluginGlobalSettings): void {
        const minutes = refreshIntervalMinutes(settings.refreshIntervalMinutes);
        if (minutes !== this.minutes) {
            this.minutes = minutes;
            streamDeck.logger.info(`Refresh interval set to ${minutes} min`);
            this.intervalListeners.forEach((listener) => listener());
        }

        const display = resetDisplayMode(settings.resetDisplay);
        if (display !== this.display) {
            this.display = display;
            setResetDisplay(display);
            streamDeck.logger.info(`Reset display set to ${display}`);
            this.displayListeners.forEach((listener) => listener());
        }
    }
}
