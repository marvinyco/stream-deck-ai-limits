import type { TileSize } from "../interfaces/settings";
import type { ServiceTheme, ThemeColors } from "../interfaces/theme";

export interface Slot {
    kind: "gauge" | "stat";
    label: string;
    /** Used instead of {@link label} inside a ring, where horizontal space is tight. */
    shortLabel?: string;
    percent?: number;
    valueText?: string;
    caption?: string;
    /** Renders the value in the muted label colour, for placeholders like "no data". */
    muted?: boolean;
}

export interface RenderOptions {
    showName?: boolean;
    /** Overrides the theme label, for generic backends such as CodexBar. */
    serviceName?: string;
    /** Scale preset; every size, gap and offset of the tile derives from it. */
    size?: TileSize;
}

/** One bar of a profiles tile: a usage percentage and its reset countdown. */
export interface ProfileBar {
    percent?: number;
    caption?: string;
    /** The account reported no such window; drawn as an empty track. */
    empty?: boolean;
}

/** One account on a profiles tile: its header and either two bars or an error. */
export interface ProfileGroup {
    label: string;
    bars?: ProfileBar[];
    error?: string;
}

/**
 * A preset is three independent moves, not one zoom: the type grows, the padding
 * and the gaps between things tighten to pay for it. That is what lets Extra Large
 * fit a 32px bar into the same 144px key.
 */
interface SizePreset {
    type: number;
    pad: number;
    gap: number;
}

const PRESETS: Record<TileSize, SizePreset> = {
    compact: { type: 0.88, pad: 1.15, gap: 1.1 },
    default: { type: 1, pad: 1, gap: 1 },
    large: { type: 1.16, pad: 0.68, gap: 0.85 },
    xlarge: { type: 1.32, pad: 0.42, gap: 0.68 }
};

/**
 * Every measurement of the default preset, in the two shapes a tile is drawn in.
 * Sizes are multiplied by `type`, margins by `pad`, the space between elements by
 * `gap`; positions are derived, never listed, so a preset cannot drift out of the
 * tile.
 */
const BASE = {
    key: {
        side: 15, edge: 7, ringEdge: 7, minSide: 8, minEdge: 4,
        header: 10, headerPad: 4.2, headerTracking: 2.5, nameAxis: 0, nameGap: 0,
        head: 12.5, headGap: 17, headBarGap: 8, bar: 24, barR: 7, time: 14, slotGap: 17,
        statLabel: 11, statValue: 23, statPad: 7.4,
        ringR: 46, ringRBare: 50, ringSw: 10, ringSwBare: 11, ringInnerPad: 5,
        ringValue: 30, ringValueMin: 10, ringLabel: 11, ringCaption: 11,
        ringLabelDy: -18, ringValueDy: 9, ringCaptionDy: 26,
        loaderR: 22, loaderSw: 6,
        icon: 14, iconStroke: 2, iconGap: 22, errText: 13, errLine: 16,
        msg: 16, msgLine: 22
    },
    dial: {
        side: 12, edge: 9, ringEdge: 4, minSide: 10, minEdge: 3,
        header: 10, headerPad: 0, headerTracking: 1.5, nameAxis: 13, nameGap: 6,
        head: 11, headGap: 13, headBarGap: 6, bar: 19, barR: 6, time: 12, slotGap: 13,
        statLabel: 12, statValue: 17, statPad: 7,
        ringR: 40, ringRBare: 40, ringSw: 9, ringSwBare: 9, ringInnerPad: 4,
        ringValue: 24, ringValueMin: 9, ringLabel: 10, ringCaption: 10,
        ringLabelDy: -15, ringValueDy: 8, ringCaptionDy: 22,
        loaderR: 17, loaderSw: 5,
        icon: 14, iconStroke: 2, iconGap: 16, errText: 12, errLine: 16,
        msg: 15, msgLine: 19
    }
};

/** Cap height as a share of the font size; how far the ink reaches above a baseline. */
const CAP = 0.72;

/** Font sizes snap to half a pixel, so a preset never lands on a blurry value. */
const snap = (v: number): number => Math.round(v * 2) / 2;

const STATE_DANGER = "#F2564F";
const STATE_WARN = "#E5A12E";

/**
 * Fixed geometry of the profiles tile. Four bars already fill a key, so it has no
 * size presets. There are no profile headers: position tells the accounts apart,
 * profile 1 on top (or on the left of the dial), and the wider gap between groups
 * keeps the pairs readable. The dial text stays smaller so a column still fits
 * both the percentage and the reset time.
 */
const PROFILES = {
    key: { pad: 8, bar: 26, barR: 7, barGap: 5, groupGap: 14, text: 16, textPad: 8 },
    dial: { pad: 8, bar: 22, barR: 6, barGap: 5, groupGap: 10, text: 12, textPad: 6 }
};

type ProfilesGeometry = typeof PROFILES.key;

/** Profile text is white over the dark track; over a light fill it turns dark. */
const PROFILES_TEXT = "#FFFFFF";
const ON_LIGHT = "#1A1505";

/**
 * The profiles tile's fill: hue runs from green (120°) at 0% through yellow at 50%
 * to red (0°) at 100%. Past yellow the saturation and lightness rise to a vivid
 * red: the Stream Deck's screen shows warm colours dimmer than a monitor does.
 */
export function usageColor(percent: number): string {
    const pct = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
    const h = 120 * (1 - pct / 100);
    const warm = Math.max(0, pct - 50) / 50;
    const s = 0.7 + 0.3 * warm;
    const l = 0.5 + 0.1 * warm;
    const a = s * Math.min(l, 1 - l);
    const channel = (n: number) => {
        const k = (n + h / 30) % 12;
        const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(v * 255).toString(16).padStart(2, "0").toUpperCase();
    };
    return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** Outline drawn under white text on a fill that is too light for white alone. */
const HALO = "#2A0A06";

/**
 * Text on a fill: dark on light fills, white on the warm end. Dark text on orange and
 * red reads as muddy whatever its measured contrast, so from orange on the text is
 * white, outlined in HALO where the fill is too light for white by itself.
 */
export function textOnFill(hex: string): { fill: string; halo?: string } {
    const [r, g] = [1, 3].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const luminance = relativeLuminance(hex);
    const white = 1.05 / (luminance + 0.05);
    if (r > g * 1.6 || white >= 4.5) {
        return white >= 4.5 ? { fill: PROFILES_TEXT } : { fill: PROFILES_TEXT, halo: HALO };
    }
    return { fill: ON_LIGHT };
}

function relativeLuminance(hex: string): number {
    const linear = (i: number) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
}

export class ProgressBarRenderer {
    private themes: Record<ServiceTheme, ThemeColors> = {
        claude: {
            primary: '#E08763',
            secondary: '#E8956B',
            background: '#221C1A',
            text: '#FBF4F0',
            label: '#A1908A',
            barBg: '#352B27',
            barFill: '#E5825B'
        },
        codex: {
            primary: '#23C892',
            secondary: '#34D399',
            background: '#101113',
            text: '#F4F4F5',
            label: '#75757D',
            barBg: '#23242A',
            barFill: '#2BD89A'
        },
        antigravity: {
            primary: '#9D7BFF',
            secondary: '#A78BFA',
            background: '#15121E',
            text: '#F3EEFF',
            label: '#928AAC',
            barBg: '#27223A',
            barFill: '#9D7BFF'
        },
        'gemini-cli': {
            primary: '#5B9BFF',
            secondary: '#8AB4F8',
            background: '#0E0F11',
            text: '#ECEDEF',
            label: '#8E929A',
            barBg: '#23272D',
            barFill: '#5B9BFF'
        },
        minimax: {
            primary: '#F8068D',
            secondary: '#FF54B0',
            background: '#18090F',
            text: '#FDEBF4',
            label: '#A57E92',
            barBg: '#2E1320',
            barFill: '#FF1F99'
        },
        openrouter: {
            primary: '#7B7DFF',
            secondary: '#8B8DF6',
            background: '#0B0B0E',
            text: '#F5F5F8',
            label: '#8A8D96',
            barBg: '#1D1D25',
            barFill: '#8284FF'
        },
        codexbar: {
            primary: '#A5B4FC',
            secondary: '#C4B5FD',
            background: '#12131B',
            text: '#F5F5FF',
            label: '#9CA3B8',
            barBg: '#25283A',
            barFill: '#A5B4FC'
        }
    };

    private static readonly serviceLabels: Partial<Record<ServiceTheme, string>> = {
        'gemini-cli': 'Gemini',
        openrouter: 'OpenRouter',
        codexbar: 'CodexBar'
    };

    private static readonly SANS = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
    private static readonly MONO = "'SF Mono', 'JetBrains Mono', 'Roboto Mono', ui-monospace, 'Menlo', monospace";

    /** Characters whose width a per-class estimate would get meaningfully wrong. */
    private static readonly CHAR_WIDTHS: Record<string, number> = {
        " ": 0.2, "1": 0.46, "%": 0.84, "$": 0.62, "\u221e": 0.89, "\u2026": 0.62,
        "-": 0.43, "\"": 0.43, "m": 0.82, "w": 0.74, "M": 0.84, "W": 0.94
    };

    private serviceName(theme: ServiceTheme): string {
        return ProgressBarRenderer.serviceLabels[theme] ?? theme.charAt(0).toUpperCase() + theme.slice(1);
    }

    render(
        session: number,
        week: number,
        theme: ServiceTheme = 'claude',
        sessionCaption?: string,
        weekCaption?: string,
        sessionLabel: string = "Session",
        weekLabel: string = "Week",
        width: number = 144,
        height: number = 144,
        sessionValueText?: string,
        weekValueText?: string,
        opts: RenderOptions = {}
    ): string {
        const slots: Slot[] = [
            {
                kind: "gauge",
                label: sessionLabel,
                percent: session,
                valueText: sessionValueText,
                caption: sessionCaption || undefined
            },
            {
                kind: "gauge",
                label: weekLabel,
                percent: week,
                valueText: weekValueText,
                caption: weekCaption || undefined
            }
        ];
        return this.renderSlots(slots, theme, width, height, opts);
    }

    renderSlots(slots: Slot[], theme: ServiceTheme = 'claude', width: number = 144, height: number = 144, opts: RenderOptions = {}): string {
        const colors = this.themes[theme];
        const isDial = this.isDial(width, height);
        const showName = opts.showName !== false;
        const displayedSlots = slots.slice(0, 2);
        const geo = this.geometry(width, height, isDial, showName, displayedSlots.length, this.preset(opts));

        const chrome = this.background(width, height, colors) + this.header(opts.serviceName ?? this.serviceName(theme), colors, geo, isDial, showName);
        const modules = displayedSlots.map((slot, i) =>
            slot.kind === "stat"
                ? this.statModule(slot, colors, theme, geo, geo.moduleTop[i], isDial)
                : this.gaugeModule(slot, colors, theme, geo, geo.moduleTop[i], isDial)
        ).join("");

        return this.svg(width, height, chrome + modules);
    }

    /**
     * Single ring gauge filling the whole tile: label, value and reset time stacked
     * inside the ring. Stat slots (credits, reset counts) keep the ring as a frame
     * and simply show their value, so a mixed set of tiles still reads as one family.
     */
    renderRing(slot: Slot, theme: ServiceTheme = 'claude', width: number = 144, height: number = 144, opts: RenderOptions = {}): string {
        const colors = this.themes[theme];
        const isDial = this.isDial(width, height);
        const showName = opts.showName !== false;
        const p = this.preset(opts);
        const geo = this.geometry(width, height, isDial, showName, 1, p);
        const ring = this.ringGeometry(width, height, isDial, showName, p);

        const isGauge = slot.kind !== "stat";
        const pct = this.clampPct(slot.percent ?? 0);
        const color = isGauge ? this.barColor(pct, theme) : colors.primary;
        const value = slot.valueText ?? (isGauge ? `${pct}%` : "—");

        const cx = this.round(ring.cx);
        const cy = this.round(ring.cy);

        let body = this.background(width, height, colors)
            + this.header(opts.serviceName ?? this.serviceName(theme), colors, geo, isDial, showName);

        body += `<circle cx="${cx}" cy="${cy}" r="${ring.r}" fill="none" stroke="${colors.barBg}" stroke-width="${ring.sw}" />`;
        if (isGauge && pct > 0) {
            const circumference = 2 * Math.PI * ring.r;
            const filled = (circumference * pct) / 100;
            body += `<circle cx="${cx}" cy="${cy}" r="${ring.r}" fill="none" stroke="${color}" stroke-width="${ring.sw}"`
                + ` stroke-linecap="round" stroke-dasharray="${this.round(filled)} ${this.round(circumference)}"`
                + ` transform="rotate(-90 ${cx} ${cy})" />`;
        }

        const labelText = slot.shortLabel ?? slot.label;
        if (labelText) {
            // Model names can be long; shrink before falling back to an ellipsis.
            const size = this.fitInRing(labelText, ring, ring.labelDy, ring.labelSize, ring.labelMin, 600);
            const label = this.fitText(labelText, size, ProgressBarRenderer.SANS, this.chord(ring.inner, ring.labelDy, size), 600);
            body += this.txt(ring.cx, ring.cy + ring.labelDy, label, size, 600, colors.label, "middle", ProgressBarRenderer.SANS);
        }

        const valueSize = this.fitInRing(value, ring, ring.valueDy, ring.valueSize, ring.valueMin, 700);
        // Shrinking keeps a long amount whole and readable; the ellipsis is only a
        // guard so nothing can ever spill over the gauge.
        const valueText = this.fitText(value, valueSize, ProgressBarRenderer.SANS, this.chord(ring.inner, ring.valueDy, valueSize), 700);
        const valueColor = slot.muted ? colors.label : color;
        body += this.txt(ring.cx, ring.cy + ring.valueDy, valueText, valueSize, 700, valueColor, "middle", ProgressBarRenderer.SANS);

        // A clipped caption carries no information, so drop it rather than ellipsise it.
        if (slot.caption) {
            const max = this.chord(ring.inner, ring.captionDy, ring.captionSize);
            if (this.measure(slot.caption, ring.captionSize, ProgressBarRenderer.SANS, 500) <= max) {
                body += this.txt(ring.cx, ring.cy + ring.captionDy, this.escape(slot.caption), ring.captionSize, 500, colors.label, "middle", ProgressBarRenderer.SANS);
            }
        }

        return this.svg(width, height, body);
    }

    /**
     * Two accounts on one tile, each a header over a session and a weekly bar.
     * The percentage and reset time sit inside each bar, so four bars fit a key.
     */
    renderProfiles(groups: ProfileGroup[], theme: ServiceTheme = 'claude', width: number = 144, height: number = 144): string {
        const colors = this.themes[theme];
        const isDial = this.isDial(width, height);
        const g = isDial ? PROFILES.dial : PROFILES.key;
        const shown = groups.slice(0, 2);
        const groupH = 2 * g.bar + g.barGap;

        let body = this.background(width, height, colors);
        if (isDial) {
            const colW = (width - 2 * g.pad - g.groupGap) / 2;
            const top = (height - groupH) / 2;
            shown.forEach((group, i) => {
                body += this.profileGroup(group, colors, theme, g, g.pad + i * (colW + g.groupGap), top, colW);
            });
        } else {
            const blockH = shown.length * groupH + Math.max(0, shown.length - 1) * g.groupGap;
            const top = (height - blockH) / 2;
            shown.forEach((group, i) => {
                body += this.profileGroup(group, colors, theme, g, g.pad, top + i * (groupH + g.groupGap), width - 2 * g.pad);
            });
        }
        return this.svg(width, height, body);
    }

    private isDial(w: number, h: number): boolean {
        return w === 200 && h === 100;
    }

    private preset(opts: RenderOptions): SizePreset {
        return PRESETS[opts.size ?? "default"] ?? PRESETS.default;
    }

    /** Margins, and the vertical band the tile's content is centred in. */
    private frame(width: number, height: number, isDial: boolean, showName: boolean, p: SizePreset) {
        const b = isDial ? BASE.dial : BASE.key;
        const edge = Math.max(b.minEdge, this.round(b.edge * p.pad));
        const side = Math.max(b.minSide, this.round(b.side * p.pad));
        const headerSize = snap(b.header * p.type);
        const headerY = Math.round(edge + headerSize * CAP);
        // The rotated name on a dial eats width, not height.
        // The gap after the name follows the name's own size, not the shrinking gaps.
        const left = Math.round(isDial && showName ? b.nameAxis + headerSize * CAP + b.nameGap * p.type : side);
        return {
            b, edge, side, headerSize, headerY, left,
            right: Math.round(width - side),
            headerTracking: this.round(b.headerTracking * p.type),
            bandTop: !isDial && showName ? headerY + b.headerPad * p.gap : edge,
            bandBottom: height - edge
        };
    }

    private ringGeometry(width: number, height: number, isDial: boolean, showName: boolean, p: SizePreset) {
        const f = this.frame(width, height, isDial, showName, p);
        const b = f.b;
        const cx = (f.left + f.right) / 2;

        // A ring is a circle: it may sit closer to the edges than a block of text.
        const ringEdge = Math.max(b.minEdge, this.round(b.ringEdge * p.pad));
        const bandTop = !isDial && showName ? f.headerY + b.headerPad * p.gap : ringEdge;
        const bandBottom = height - ringEdge;
        const cy = this.round((bandTop + bandBottom) / 2);

        const sw = snap((showName ? b.ringSw : b.ringSwBare) * p.type);
        const baseR = showName ? b.ringR : b.ringRBare;
        // The type takes the whole step even where the ring runs out of room; what
        // does not fit inside the gauge is shrunk to fit by fitFontSize, never clipped.
        const r = this.round(Math.min(baseR * p.type, (bandBottom - bandTop) / 2 - sw / 2));
        const ratio = r / baseR;
        // Air between the stroke and the text; without it a chord-limited value at a
        // big preset would sit flush against its own gauge.
        const inner = r - sw / 2 - b.ringInnerPad * ratio;

        return {
            cx, cy, r, sw, inner,
            labelSize: snap(b.ringLabel * p.type),
            labelMin: snap(b.ringLabel * ratio * 0.77),
            labelDy: this.round(b.ringLabelDy * ratio),
            valueSize: snap(b.ringValue * p.type),
            valueMin: snap(b.ringValueMin * ratio),
            valueDy: this.round(b.ringValueDy * ratio),
            captionSize: snap(b.ringCaption * p.type),
            captionDy: this.round(b.ringCaptionDy * ratio)
        };
    }

    private geometry(width: number, height: number, isDial: boolean, showName: boolean, moduleCount = 2, p: SizePreset = PRESETS.default) {
        const f = this.frame(width, height, isDial, showName, p);
        const b = f.b;

        const head = snap(b.head * p.type);
        const labelRow = this.round(head * CAP);
        const barH = Math.round(b.bar * p.type);
        const barY = Math.round(labelRow + b.headBarGap * p.gap);
        const moduleH = barY + barH;
        const slotGap = Math.round(b.slotGap * p.gap);

        // Modules are stacked by their ink, then the stack is centred in the band —
        // so every preset ends up with balanced air above and below.
        const count = Math.min(2, Math.max(1, moduleCount));
        const blockH = count * moduleH + (count - 1) * slotGap;
        const top = Math.round(f.bandTop + Math.max(0, f.bandBottom - f.bandTop - blockH) / 2);
        const moduleTop = Array.from({ length: count }, (_, i) => top + i * (moduleH + slotGap));

        // A stat has no bar, so its label and value are centred in the module instead.
        const statLabel = snap(b.statLabel * p.type);
        const statValue = snap(b.statValue * p.type);
        const statStep = this.round(statValue * CAP + b.statPad * p.gap);
        const statTop = Math.max(0, (moduleH - (statLabel * CAP + statStep)) / 2);

        return {
            width,
            height,
            nameAxis: b.nameAxis,
            left: f.left,
            right: f.right,
            innerW: f.right - f.left,
            headerY: f.headerY,
            headerSize: f.headerSize,
            headerMin: snap(f.headerSize * 0.65),
            headerTracking: f.headerTracking,
            labelRow,
            percentSize: head,
            barY,
            barH,
            barR: Math.round(b.barR * p.type),
            headGap: Math.round(b.headGap * p.type),
            timeSize: snap(b.time * p.type),
            statLabelSize: statLabel,
            statLabelRow: this.round(statTop + statLabel * CAP),
            statValueSize: statValue,
            statValueRow: this.round(statTop + statLabel * CAP + statStep),
            statValueMin: snap(13 * p.type),
            bandTop: f.bandTop,
            bandBottom: f.bandBottom,
            moduleTop
        };
    }

    /**
     * Largest size at which a line still fits the ring at its offset. The room a
     * line has depends on its own size, so the chord is re-measured at every step
     * rather than taken once at the largest size.
     */
    private fitInRing(text: string, ring: { inner: number }, dy: number, max: number, min: number, weight: number): number {
        let size = max;
        while (size > min && this.measure(text, size, ProgressBarRenderer.SANS, weight) > this.chord(ring.inner, dy, size)) {
            size -= 0.5;
        }
        return size;
    }

    /** Widest line of text that still fits inside the ring at a given vertical offset. */
    private chord(inner: number, dy: number, size: number): number {
        const y = Math.max(Math.abs(dy), Math.abs(dy - size * 0.72));
        if (y >= inner) return 0;
        return 2 * Math.sqrt(inner * inner - y * y);
    }

    private svg(width: number, height: number, body: string): string {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
    }

    private background(width: number, height: number, colors: ThemeColors): string {
        return `<rect width="${width}" height="${height}" fill="${colors.background}" />`;
    }

    private header(name: string, colors: ThemeColors, geo: any, isDial: boolean, showName: boolean): string {
        if (!showName) return "";
        const upper = name.toUpperCase();
        const text = this.escape(upper);
        if (isDial) {
            const axisX = geo.nameAxis;
            const cy = geo.height / 2;
            const size = this.fitFontSize(upper, geo.headerSize, geo.headerMin, ProgressBarRenderer.SANS, geo.height - 22, geo.headerTracking);
            const ax = axisX + size * 0.34;
            return `<text x="${this.round(ax)}" y="${this.round(cy)}" font-family="${ProgressBarRenderer.SANS}" font-size="${size}" font-weight="700" letter-spacing="${geo.headerTracking}" fill="${colors.label}" text-anchor="middle" transform="rotate(-90 ${this.round(ax)} ${this.round(cy)})">${text}</text>`;
        }
        const fitted = this.fitText(upper, geo.headerSize, ProgressBarRenderer.SANS, geo.innerW, 700, geo.headerTracking);
        return this.txt((geo.left + geo.right) / 2, geo.headerY, fitted, geo.headerSize, 700, colors.label, "middle", ProgressBarRenderer.SANS, geo.headerTracking);
    }

    private gaugeModule(slot: Slot, colors: ThemeColors, theme: ServiceTheme, geo: any, top: number, isDial: boolean): string {
        const pct = this.clampPct(slot.percent ?? 0);
        const color = this.barColor(pct, theme);
        const time = slot.caption ?? "";
        const raw = slot.valueText ?? `${pct}%`;

        const weight = 500;
        const headSize = geo.percentSize;
        const headGap = geo.headGap;
        const m = raw.match(/^(\d+)(%)$/);
        const percentText = m ? `${m[1]}${m[2]}` : raw;
        const percentW = this.measure(percentText, headSize, ProgressBarRenderer.SANS, weight);

        const labelMax = geo.innerW - percentW - headGap;
        const label = this.fitText(slot.label, headSize, ProgressBarRenderer.SANS, labelMax, weight);

        const barTop = top + geo.barY;
        const r = geo.barR;
        const fw = this.round((geo.innerW * pct) / 100);
        const cx = (geo.left + geo.right) / 2;
        const timeY = barTop + geo.barH / 2 + geo.timeSize * 0.35;
        const onFill = color === STATE_WARN ? "#1A1505" : "#FFFFFF";

        const labelW = this.measure(label, headSize, ProgressBarRenderer.SANS, weight);
        const headRow = top + geo.labelRow;
        const startX = cx - (percentW + headGap + labelW) / 2;

        let out = "";
        out += this.txt(startX, headRow, this.escape(percentText), headSize, weight, colors.text, "start", ProgressBarRenderer.SANS);
        out += this.txt(startX + percentW + headGap, headRow, label, headSize, weight, colors.label, "start", ProgressBarRenderer.SANS);
        out += `<rect x="${geo.left}" y="${barTop}" width="${this.round(geo.innerW)}" height="${geo.barH}" rx="${r}" fill="${colors.barBg}" />`;
        out += this.trackFill(geo.left, barTop, fw, geo.barH, this.round(geo.innerW), r, color);
        if (time) {
            out += this.splitText(cx, timeY, time, geo.timeSize, 500, "middle", geo.left + fw, colors.label, onFill);
        }
        return out;
    }

    private statModule(slot: Slot, colors: ThemeColors, theme: ServiceTheme, geo: any, top: number, isDial: boolean): string {
        const value = slot.valueText ?? "—";
        const cx = (geo.left + geo.right) / 2;

        let out = "";
        const label = this.fitText(slot.label, geo.statLabelSize, ProgressBarRenderer.SANS, geo.innerW, 600);
        out += this.txt(cx, top + geo.statLabelRow, label, geo.statLabelSize, 600, colors.label, "middle", ProgressBarRenderer.SANS);
        const font = this.fitFontSize(value, geo.statValueSize, geo.statValueMin, ProgressBarRenderer.SANS, geo.innerW);
        out += this.txt(cx, top + geo.statValueRow, this.escape(value), font, 700, colors.primary, "middle", ProgressBarRenderer.SANS);
        return out;
    }

    private profileGroup(group: ProfileGroup, colors: ThemeColors, theme: ServiceTheme, g: ProfilesGeometry, left: number, top: number, w: number): string {
        const SANS = ProgressBarRenderer.SANS;
        // Without headers, an error is the one place the label is needed to say which
        // account failed. It takes the first bar row and the message the second.
        if (group.error) {
            const row = (i: number) => top + i * (g.bar + g.barGap) + g.bar / 2 + g.text * 0.35;
            return this.txt(left, row(0), this.fitText(group.label.toUpperCase(), g.text, SANS, w, 700), g.text, 700, PROFILES_TEXT, "start", SANS)
                + this.txt(left, row(1), this.fitText(group.error, g.text, SANS, w, 600), g.text, 600, PROFILES_TEXT, "start", SANS);
        }

        let out = "";
        for (let i = 0; i < 2; i++) {
            const bar = group.bars?.[i] ?? { empty: true };
            out += this.profileBar(bar, colors, theme, g, left, top + i * (g.bar + g.barGap), w);
        }
        return out;
    }

    private profileBar(bar: ProfileBar, colors: ThemeColors, theme: ServiceTheme, g: ProfilesGeometry, left: number, top: number, w: number): string {
        const SANS = ProgressBarRenderer.SANS;
        const x = this.round(left);
        const y = this.round(top);
        const width = this.round(w);
        const textY = top + g.bar / 2 + g.text * 0.35;
        let out = `<rect x="${x}" y="${y}" width="${width}" height="${g.bar}" rx="${g.barR}" fill="${colors.barBg}" />`;

        if (bar.empty) {
            return out + this.txt(left + g.textPad, textY, "—", g.text, 600, PROFILES_TEXT, "start", SANS);
        }

        const pct = this.clampPct(bar.percent ?? 0);
        const color = usageColor(pct);
        const fw = this.round((w * pct) / 100);
        const pctText = `${pct}%`;
        const captionMax = w - 2 * g.textPad - this.measure(pctText, g.text, SANS, 600) - 6;
        // A wide caption such as "WED 12PM" shrinks a little before it is truncated.
        const captionSize = bar.caption ? this.fitFontSize(bar.caption, g.text, g.text * 0.75, SANS, captionMax) : g.text;
        const caption = bar.caption ? this.truncate(bar.caption, captionSize, SANS, captionMax, 500) : "";
        const onFill = textOnFill(color);
        const edge = left + fw;

        out += this.trackFill(x, y, fw, g.bar, width, g.barR, color);
        out += this.splitText(left + g.textPad, textY, pctText, g.text, 600, "start", edge, PROFILES_TEXT, onFill.fill, onFill.halo);
        if (caption) {
            out += this.splitText(left + w - g.textPad, textY, caption, captionSize, 500, "end", edge, PROFILES_TEXT, onFill.fill, onFill.halo);
        }
        return out;
    }

    renderLoader(angle: number, theme: ServiceTheme = 'claude', width: number = 144, height: number = 144, opts: RenderOptions = {}): string {
        const colors = this.themes[theme];
        const isDial = this.isDial(width, height);
        const showName = opts.showName !== false;
        const p = this.preset(opts);
        const b = isDial ? BASE.dial : BASE.key;
        const geo = this.geometry(width, height, isDial, showName, 2, p);
        const cx = (geo.left + geo.right) / 2;
        const cy = this.round((geo.bandTop + geo.bandBottom) / 2);
        const r = this.round(b.loaderR * p.type);
        const sw = snap(b.loaderSw * p.type);
        const dash = 2 * Math.PI * r;

        const ring = `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${colors.barBg}" stroke-width="${sw}" fill="none" />`
            + `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${colors.primary}" stroke-width="${sw}" fill="none" stroke-linecap="round" `
            + `stroke-dasharray="${this.round(dash * 0.28)} ${this.round(dash)}" transform="rotate(${angle} ${cx} ${cy})" />`;

        const body = this.background(width, height, colors)
            + this.header(opts.serviceName ?? this.serviceName(theme), colors, geo, isDial, showName)
            + ring;
        return this.svg(width, height, body);
    }

    renderError(message: string, theme: ServiceTheme = 'claude', width: number = 144, height: number = 144, opts: RenderOptions = {}): string {
        const colors = this.themes[theme];
        const isDial = this.isDial(width, height);
        const showName = opts.showName !== false;
        const p = this.preset(opts);
        const b = isDial ? BASE.dial : BASE.key;
        const geo = this.geometry(width, height, isDial, showName, 2, p);
        const cx = (geo.left + geo.right) / 2;

        const r = this.round(b.icon * p.type);
        const size = snap(b.errText * p.type);
        const gap = b.iconGap * p.gap;
        const lineH = b.errLine * p.type;
        const lines = this.wrapText(message, size, ProgressBarRenderer.SANS, geo.innerW + 4, 2, 600);
        // Icon and message are one block, centred in the same band as everything else.
        const blockH = 2 * r + gap + lineH * lines.length;
        const top = geo.bandTop + Math.max(0, geo.bandBottom - geo.bandTop - blockH) / 2;

        const cyIcon = this.round(top + r);
        const t = p.type;
        const icon = `<circle cx="${cx}" cy="${cyIcon}" r="${r}" fill="none" stroke="${STATE_DANGER}" stroke-width="${snap(b.iconStroke * t)}" />`
            + `<rect x="${this.round(cx - t)}" y="${this.round(cyIcon - 7 * t)}" width="${snap(2 * t)}" height="${this.round(8 * t)}" rx="1" fill="${STATE_DANGER}" />`
            + `<circle cx="${cx}" cy="${this.round(cyIcon + 5 * t)}" r="${this.round(1.4 * t)}" fill="${STATE_DANGER}" />`;

        const startY = cyIcon + r + gap;
        const text = lines.map((l, i) => this.txt(cx, startY + i * lineH, l, size, 600, colors.text, "middle", ProgressBarRenderer.SANS)).join("");

        const body = this.background(width, height, colors)
            + this.header(opts.serviceName ?? this.serviceName(theme), colors, geo, isDial, showName)
            + icon + text;
        return this.svg(width, height, body);
    }

    renderPlaceholder(theme: ServiceTheme = 'claude', width: number = 144, height: number = 144, opts: RenderOptions = {}): string {
        return this.renderLoader(0, theme, width, height, opts);
    }

    renderMessage(lines: string[], theme: ServiceTheme = 'claude', width: number = 144, height: number = 144, opts: RenderOptions = {}): string {
        const colors = this.themes[theme];
        const isDial = this.isDial(width, height);
        const showName = opts.showName !== false;
        const p = this.preset(opts);
        const b = isDial ? BASE.dial : BASE.key;
        const geo = this.geometry(width, height, isDial, showName, 2, p);
        const cx = (geo.left + geo.right) / 2;
        const size = snap(b.msg * p.type);
        const lineH = b.msgLine * p.type;
        const cap = size * CAP;
        // Centre the ink of the block, not its baselines.
        const startY = (geo.bandTop + geo.bandBottom) / 2 + cap / 2 - ((lines.length - 1) * lineH) / 2;
        const text = lines.map((line, i) =>
            this.txt(cx, startY + i * lineH, this.escape(line), size, 700, colors.text, "middle", ProgressBarRenderer.SANS)
        ).join("");
        const body = this.background(width, height, colors)
            + this.header(opts.serviceName ?? this.serviceName(theme), colors, geo, isDial, showName)
            + text;
        return this.svg(width, height, body);
    }

    private txt(x: number, y: number, content: string, size: number, weight: number, fill: string, anchor: string, family: string, tracking = 0): string {
        const ls = tracking ? ` letter-spacing="${tracking}"` : "";
        return `<text x="${this.round(x)}" y="${this.round(y)}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${ls}>${content}</text>`;
    }

    private barColor(value: number, theme: ServiceTheme): string {
        const colors = this.themes[theme];
        if (value > 88) return STATE_DANGER;
        if (value > 70) return STATE_WARN;
        return colors.barFill || colors.primary;
    }

    private clampPct(v: number): number {
        if (!Number.isFinite(v)) return 0;
        return Math.max(0, Math.min(100, Math.round(v)));
    }

    /**
     * Advance width of one character, in ems, sampled from SF Pro at weight 500 —
     * the face the tiles actually render in, and close enough to Segoe UI and Inter
     * to place text by. Averaging every character to a single factor underestimated
     * "%" and digits by a quarter, which let a ring value overlap its own gauge.
     */
    private charWidth(ch: string, family: string): number {
        if (family === ProgressBarRenderer.MONO) return 0.6;
        const known = ProgressBarRenderer.CHAR_WIDTHS[ch];
        if (known !== undefined) return known;
        if (ch >= "0" && ch <= "9") return 0.61;
        if ("iIjl.,:;'!|".includes(ch)) return 0.24;
        if ("frt/()[]".includes(ch)) return 0.33;
        if (ch >= "A" && ch <= "Z") return 0.65;
        // CJK and other full-width scripts advance a whole em.
        if (ch.codePointAt(0)! > 0x2e7f) return 1;
        return 0.53;
    }

    private measure(text: string, size: number, family: string, weight: number): number {
        // Heavier cuts of the same face are a few percent wider, uniformly enough
        // to fold into a single multiplier.
        const bold = weight >= 700 ? 1.06 : weight >= 600 ? 1.03 : 1;
        let ems = 0;
        for (const ch of text) ems += this.charWidth(ch, family);
        return ems * size * bold;
    }

    private fitText(text: string, size: number, family: string, maxWidth: number, weight = 600, tracking = 0): string {
        return this.escape(this.truncate(text, size, family, maxWidth, weight, tracking));
    }

    /** Like fitText, but unescaped, for text that is escaped piece by piece later. */
    private truncate(text: string, size: number, family: string, maxWidth: number, weight = 600, tracking = 0): string {
        const w = (s: string) => this.measure(s, size, family, weight) + Math.max(0, s.length - 1) * tracking;
        const clean = text.trim();
        if (w(clean) <= maxWidth) return clean;
        const ell = "…";
        let lo = 0, hi = clean.length;
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            if (w(clean.slice(0, mid) + ell) <= maxWidth) lo = mid;
            else hi = mid - 1;
        }
        return clean.slice(0, lo).trimEnd() + ell;
    }

    private fitFontSize(text: string, max: number, min: number, family: string, maxWidth: number, tracking = 0): number {
        let size = max;
        const w = (s: number) => this.measure(text, s, family, 700) + Math.max(0, text.length - 1) * tracking;
        while (size > min && w(size) > maxWidth) size -= 0.5;
        return Math.round(size * 10) / 10;
    }

    private wrapText(text: string, size: number, family: string, maxWidth: number, maxLines: number, weight = 600): string[] {
        const words = text.trim().split(/\s+/);
        const lines: string[] = [];
        let line = "";
        for (const w of words) {
            const next = line ? `${line} ${w}` : w;
            if (this.measure(next, size, family, weight) <= maxWidth || !line) {
                line = next;
            } else {
                lines.push(line);
                line = w;
                if (lines.length === maxLines - 1) break;
            }
        }
        if (line && lines.length < maxLines) lines.push(line);
        const last = lines.length - 1;
        if (last >= 0 && this.measure(lines[last], size, family, weight) > maxWidth) {
            return lines.slice(0, last).map((l) => this.escape(l)).concat(this.fitText(lines[last], size, family, maxWidth, weight));
        }
        return lines.map((l) => this.escape(l));
    }

    /**
     * A fill exactly proportional to its width, however narrow: the track's rounded
     * shape cut off at the fill's width. It is drawn as a path because the Stream Deck
     * SVG renderer ignores clipPath, and a rounded rect can't be narrower than its corners.
     */
    private trackFill(x: number, y: number, fw: number, h: number, trackW: number, r: number, color: string): string {
        if (fw <= 0) return "";
        const c = Math.min(fw, trackW);
        const R = Math.min(r, h / 2, trackW / 2);
        const n = (v: number) => this.round(v);
        // How far a corner arc sits in from the top and bottom edges at a given inset.
        const arcInset = (inset: number) => R - Math.sqrt(Math.max(0, R * R - inset * inset));
        let d: string;
        if (R <= 0) {
            d = `M${n(x)} ${n(y)}H${n(x + c)}V${n(y + h)}H${n(x)}Z`;
        } else if (c <= R) {
            // Only part of the left corners: a sliver following their curve.
            const dy = arcInset(R - c);
            d = `M${n(x + c)} ${n(y + dy)}V${n(y + h - dy)}`
                + `A${R} ${R} 0 0 1 ${n(x)} ${n(y + h - R)}V${n(y + R)}`
                + `A${R} ${R} 0 0 1 ${n(x + c)} ${n(y + dy)}Z`;
        } else {
            // Rounded left end; the right end is straight until it reaches the track's own corners.
            const dy = c > trackW - R ? arcInset(c - (trackW - R)) : 0;
            const right = dy > 0
                ? `H${n(x + trackW - R)}A${R} ${R} 0 0 1 ${n(x + c)} ${n(y + dy)}V${n(y + h - dy)}A${R} ${R} 0 0 1 ${n(x + trackW - R)} ${n(y + h)}`
                : `H${n(x + c)}V${n(y + h)}`;
            d = `M${n(x + R)} ${n(y)}${right}H${n(x + R)}`
                + `A${R} ${R} 0 0 1 ${n(x)} ${n(y + h - R)}V${n(y + R)}`
                + `A${R} ${R} 0 0 1 ${n(x + R)} ${n(y)}Z`;
        }
        return `<path d="${d}" fill="${color}" />`;
    }

    /**
     * Text that changes colour where the fill ends: each character takes the fill's
     * text colour when its centre sits over the fill, the base colour otherwise. The
     * Stream Deck renderer ignores clipPath, so this is done with tspans instead. With
     * a halo, the characters over the fill get an outline: a stroked copy drawn first.
     */
    private splitText(x: number, y: number, text: string, size: number, weight: number, anchor: "start" | "middle" | "end", edgeX: number, base: string, onFill: string, halo?: string): string {
        const SANS = ProgressBarRenderer.SANS;
        const total = this.measure(text, size, SANS, weight);
        const startX = anchor === "start" ? x : anchor === "end" ? x - total : x - total / 2;
        const runs: { over: boolean; text: string }[] = [];
        let offset = 0;
        for (const ch of text) {
            const cw = this.measure(ch, size, SANS, weight);
            const over = startX + offset + cw / 2 < edgeX;
            offset += cw;
            const last = runs[runs.length - 1];
            if (last && last.over === over) last.text += ch;
            else runs.push({ over, text: ch });
        }
        const fillOf = (over: boolean) => (over ? onFill : base);

        let under = "";
        if (halo && runs.some((run) => run.over)) {
            const stroke = `stroke="${halo}" stroke-width="${this.round(size * 0.2)}" stroke-linejoin="round"`;
            under = runs.length === 1
                ? `<text x="${this.round(x)}" y="${this.round(y)}" font-family="${SANS}" font-size="${size}" font-weight="${weight}" fill="${halo}" ${stroke} text-anchor="${anchor}">${this.escape(text)}</text>`
                : this.txt(x, y, runs.map((run) => run.over
                    ? `<tspan fill="${halo}" ${stroke}>${this.escape(run.text)}</tspan>`
                    : `<tspan fill="none">${this.escape(run.text)}</tspan>`).join(""), size, weight, "none", anchor, SANS);
        }

        if (runs.length <= 1 || onFill === base) {
            return under + this.txt(x, y, this.escape(text), size, weight, fillOf(runs[0]?.over ?? false), anchor, SANS);
        }
        const content = runs.map((run) => `<tspan fill="${fillOf(run.over)}">${this.escape(run.text)}</tspan>`).join("");
        return under + this.txt(x, y, content, size, weight, base, anchor, SANS);
    }

    private round(n: number): number {
        return Math.round(n * 100) / 100;
    }

    private escape(s: string): string {
        return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

}
