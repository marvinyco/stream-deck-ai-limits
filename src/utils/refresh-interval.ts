export const MIN_REFRESH_MINUTES = 1;
export const MAX_REFRESH_MINUTES = 60;
export const DEFAULT_REFRESH_MINUTES = 15;

/** Whole minutes within the slider's range; anything unusable falls back to the default. */
export function refreshIntervalMinutes(value: unknown): number {
    const minutes = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    if (typeof minutes !== "number" || !Number.isFinite(minutes)) {
        return DEFAULT_REFRESH_MINUTES;
    }
    return Math.min(MAX_REFRESH_MINUTES, Math.max(MIN_REFRESH_MINUTES, Math.round(minutes)));
}
