export type ResetDisplay = "remaining" | "reset";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DAY_MS = 24 * 60 * 60 * 1000;

let currentDisplay: ResetDisplay = "remaining";

export function resetDisplayMode(value: unknown): ResetDisplay {
    return value === "reset" ? "reset" : "remaining";
}

/** Set from the plugin-wide global setting; every reset caption follows it. */
export function setResetDisplay(mode: ResetDisplay): void {
    currentDisplay = mode;
}

/** The caption for a reset time in the plugin-wide display mode. */
export function formatTimeUntil(resetTime: string | number | null): string {
    return formatResetCaption(resetTime, currentDisplay);
}

/**
 * "remaining": a countdown such as "2h 30m" or "3d 4h".
 * "reset": the local clock time, "14:30" within a day; beyond that the weekday and
 * hour only, "MON 2PM", so it still fits the narrow profile bars.
 */
export function formatResetCaption(resetTime: string | number | null, mode: ResetDisplay, now: number = Date.now()): string {
    if (!resetTime) return "";

    const resetDate = typeof resetTime === "number" ? new Date(resetTime * 1000) : new Date(resetTime);
    const diffMs = resetDate.getTime() - now;
    if (!Number.isFinite(diffMs)) return "";
    if (diffMs <= 0) return "now";

    return mode === "reset" ? clockTime(resetDate, diffMs) : countdown(diffMs);
}

function clockTime(date: Date, diffMs: number): string {
    const hours = date.getHours();
    if (diffMs < DAY_MS) {
        return `${String(hours).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    }
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${WEEKDAYS[date.getDay()]} ${hour12}${hours < 12 ? "AM" : "PM"}`;
}

function countdown(diffMs: number): string {
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        const hours = diffHours % 24;
        return hours > 0 ? `${diffDays}d ${hours}h` : `${diffDays}d`;
    }

    if (diffHours > 0) {
        const minutes = diffMinutes % 60;
        return minutes > 0 ? `${diffHours}h ${minutes}m` : `${diffHours}h`;
    }

    return `${diffMinutes}m`;
}
