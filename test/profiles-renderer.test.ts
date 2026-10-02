import { test } from "node:test";
import assert from "node:assert/strict";
import { ProgressBarRenderer, usageColor } from "../src/ui/progress-bar-renderer.ts";

const renderer = new ProgressBarRenderer();
const mockup = [
    { label: "Work", bars: [{ percent: 16, caption: "3h 33m" }, { percent: 92, caption: "16h 3m" }] },
    { label: "Personal", bars: [{ percent: 48, caption: "1h 12m" }, { percent: 31, caption: "4d 2h" }] }
];

test("draws percentages and reset times without profile headers", () => {
    const svg = renderer.renderProfiles(mockup, "claude", 144, 144);
    assert.match(svg, /^<svg [^>]*width="144" height="144"/);
    for (const text of ["16%", "92%", "48%", "31%", "3h 33m", "16h 3m", "1h 12m", "4d 2h"]) {
        assert.ok(svg.includes(`>${text}</text>`), `missing ${text}`);
    }
    for (const label of ["WORK", "PERSONAL", "CLAUDE"]) {
        assert.ok(!svg.includes(label), `${label} should not be drawn`);
    }
});

test("uses 26px bars with 16px text on a key", () => {
    const svg = renderer.renderProfiles(mockup, "claude", 144, 144);
    assert.ok(svg.includes('height="26"'));
    assert.ok(svg.includes('font-size="16"'));
});

test("puts profile 1 on top", () => {
    const svg = renderer.renderProfiles(mockup, "claude", 144, 144);
    const y = (text: string) => Number(svg.match(new RegExp(`<text x="[^"]+" y="([^"]+)"[^>]*>${text}</text>`))?.[1]);
    assert.ok(y("16%") < y("92%"));
    assert.ok(y("92%") < y("48%"));
    assert.ok(y("48%") < y("31%"));
});

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test("usageColor runs from green at 0% through yellow to red at 100%", () => {
    const [r0, g0, b0] = rgb(usageColor(0));
    assert.ok(g0 > r0 * 2 && g0 > b0 * 2, `0% should be green, got ${usageColor(0)}`);
    const [r50, g50, b50] = rgb(usageColor(50));
    assert.ok(Math.abs(r50 - g50) < 20 && b50 < r50 / 2, `50% should be yellow, got ${usageColor(50)}`);
    const [r100, g100, b100] = rgb(usageColor(100));
    assert.ok(r100 > g100 * 2 && r100 > b100 * 2, `100% should be red, got ${usageColor(100)}`);
});

test("usageColor shifts steadily from green towards red", () => {
    let previous = -Infinity;
    for (let pct = 0; pct <= 100; pct += 10) {
        const [r, g] = rgb(usageColor(pct));
        assert.ok(r - g > previous, `red should gain on green at ${pct}%`);
        previous = r - g;
    }
});

test("usageColor clamps out-of-range values", () => {
    assert.equal(usageColor(-20), usageColor(0));
    assert.equal(usageColor(150), usageColor(100));
    assert.equal(usageColor(Number.NaN), usageColor(0));
    assert.match(usageColor(37), /^#[0-9A-F]{6}$/);
});

test("every piece of profile text is white", () => {
    const fills = (svg: string) => [...svg.matchAll(/<text [^>]*fill="([^"]+)"/g)].map((m) => m[1]);
    const bars = renderer.renderProfiles(mockup, "claude", 144, 144);
    const errors = renderer.renderProfiles([
        { label: "Work", error: "Login Expired" },
        { label: "Personal", bars: [{ empty: true }, { percent: 50 }] }
    ], "claude", 144, 144);
    for (const fill of [...fills(bars), ...fills(errors)]) assert.equal(fill, "#FFFFFF");
});

test("profile bars fill with the usage colour", () => {
    const svg = renderer.renderProfiles(mockup, "claude", 144, 144);
    for (const pct of [16, 92, 48, 31]) {
        assert.ok(svg.includes(`fill="${usageColor(pct)}"`), `missing fill for ${pct}%`);
    }
    assert.ok(!svg.includes('fill="#F2564F"'), "the old warning red is not used");
});

test("clamps percentages to 0-100 and keeps fills inside the track", () => {
    const svg = renderer.renderProfiles([
        { label: "A", bars: [{ percent: 140 }, { percent: -5 }] },
        { label: "B", bars: [{ percent: Number.NaN }, { percent: 50 }] }
    ], "claude", 144, 144);
    assert.ok(svg.includes(">100%</text>"));
    assert.ok(svg.includes(">0%</text>"));
    assert.ok(!svg.includes("NaN"));
    for (const [, w] of svg.matchAll(/<rect x="[^"]+" y="[^"]+" width="([^"]+)"/g)) {
        assert.ok(Number(w) <= 144, `rect width ${w} exceeds the key`);
    }
});

test("escapes and truncates labels on the error line", () => {
    const svg = renderer.renderProfiles([
        { label: "R&D <team>", error: "Auth Required" },
        { label: "My very long profile name here", error: "Login Expired" }
    ], "claude", 144, 144);
    assert.ok(svg.includes(">R&amp;D &lt;TEAM&gt;</text>"));
    assert.ok(svg.includes(">Auth Required</text>"));
    assert.ok(!svg.includes("<team>") && !svg.includes("<TEAM>"));
    assert.ok(svg.includes(">MY VERY LON…</text>"), "a label wider than the key gets an ellipsis");
});

test("an errored profile shows its message instead of bars", () => {
    const svg = renderer.renderProfiles([
        { label: "Work", error: "Login Expired" },
        { label: "Personal", error: "Auth Required" }
    ], "claude", 144, 144);
    for (const text of ["WORK", "Login Expired", "PERSONAL", "Auth Required"]) {
        assert.ok(svg.includes(`>${text}</text>`), `missing ${text}`);
    }
    assert.ok(!svg.includes("%</text>"));
});

test("an empty bar shows a dash and no fill", () => {
    const svg = renderer.renderProfiles([
        { label: "Work", bars: [{ empty: true }, { empty: true }] },
        { label: "Personal", bars: [{ empty: true }, { percent: 10 }] }
    ], "claude", 144, 144);
    assert.equal([...svg.matchAll(/>—<\/text>/g)].length, 3);
    assert.equal([...svg.matchAll(/%<\/text>/g)].length, 1);
});

test("draws the dial as two columns", () => {
    const svg = renderer.renderProfiles(mockup, "claude", 200, 100);
    assert.match(svg, /^<svg [^>]*width="200" height="100"/);
    const x = (text: string) => Number(svg.match(new RegExp(`<text x="([^"]+)"[^>]*>${text}</text>`))?.[1]);
    assert.ok(x("16%") < 100, "profile 1 sits in the left-hand column");
    assert.ok(x("48%") > 100, "profile 2 sits in the right-hand column");
    assert.ok(!svg.includes("WORK") && !svg.includes("PERSONAL"));
    for (const text of ["3h 33m", "16h 3m", "1h 12m", "4d 2h"]) {
        assert.ok(svg.includes(`>${text}</text>`), `dial truncated ${text}`);
    }
});

test("fill width is exactly proportional to the percentage", () => {
    const fillWidth = (pct: number) => {
        const svg = renderer.renderProfiles([{ label: "A", bars: [{ percent: pct }] }], "claude", 144, 144);
        const fill = svg.match(new RegExp(`<rect [^>]*width="([^"]+)"[^>]*fill="${usageColor(pct)}"`));
        assert.ok(fill, `missing fill for ${pct}%`);
        return Number(fill[1]);
    };
    const track = 144 - 2 * 8;
    for (const pct of [2, 5, 16, 50, 100]) {
        assert.ok(Math.abs(fillWidth(pct) - (track * pct) / 100) < 0.01, `${pct}% fill is ${fillWidth(pct)}`);
    }
});
