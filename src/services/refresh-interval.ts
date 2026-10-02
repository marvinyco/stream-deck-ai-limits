import streamDeck from "@elgato/streamdeck";
import { DEFAULT_REFRESH_MINUTES, refreshIntervalMinutes } from "../utils/refresh-interval";

interface RefreshGlobalSettings {
    refreshIntervalMinutes?: number;
    [key: string]: any;
}

type Listener = (intervalMs: number) => void;

/**
 * The plugin-wide refresh interval, kept in global settings so one slider on any
 * settings page drives every action's timer.
 */
export class RefreshInterval {
    private static instance: RefreshInterval | null = null;
    private minutes = DEFAULT_REFRESH_MINUTES;
    private readonly listeners = new Set<Listener>();

    static getInstance(): RefreshInterval {
        if (!RefreshInterval.instance) {
            RefreshInterval.instance = new RefreshInterval();
        }
        return RefreshInterval.instance;
    }

    get ms(): number {
        return this.minutes * 60_000;
    }

    /** Register before connecting so the first global settings event is not missed. */
    listen(): void {
        streamDeck.settings.onDidReceiveGlobalSettings<RefreshGlobalSettings>((ev) => {
            this.apply(ev.settings?.refreshIntervalMinutes);
        });
    }

    async load(): Promise<void> {
        const global = await streamDeck.settings.getGlobalSettings<RefreshGlobalSettings>();
        this.apply(global?.refreshIntervalMinutes);
    }

    onChange(listener: Listener): void {
        this.listeners.add(listener);
    }

    private apply(value: unknown): void {
        const minutes = refreshIntervalMinutes(value);
        if (minutes === this.minutes) return;
        this.minutes = minutes;
        streamDeck.logger.info(`Refresh interval set to ${minutes} min`);
        for (const listener of this.listeners) {
            listener(this.ms);
        }
    }
}
