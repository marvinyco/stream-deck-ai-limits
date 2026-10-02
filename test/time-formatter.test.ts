import { test } from "node:test";
import assert from "node:assert/strict";
import { formatResetCaption, resetDisplayMode } from "../src/utils/time-formatter.ts";

// Thursday 2026-10-01 09:15 local time.
const now = new Date(2026, 9, 1, 9, 15).getTime();
const at = (days: number, h: number, m: number) => new Date(2026, 9, 1 + days, h, m).toISOString();

test("remaining mode shows the countdown", () => {
    assert.equal(formatResetCaption(at(0, 11, 45), "remaining", now), "2h 30m");
    assert.equal(formatResetCaption(at(3, 12, 15), "remaining", now), "3d 3h");
});

test("reset mode shows HH:MM within 24 hours", () => {
    assert.equal(formatResetCaption(at(0, 9, 20), "reset", now), "09:20");
    assert.equal(formatResetCaption(at(0, 23, 5), "reset", now), "23:05");
    assert.equal(formatResetCaption(at(1, 9, 14), "reset", now), "09:14");
});

test("reset mode shows the weekday and 12-hour hour from 24 hours on", () => {
    assert.equal(formatResetCaption(at(1, 9, 15), "reset", now), "FRI 9AM");
    assert.equal(formatResetCaption(at(4, 14, 0), "reset", now), "MON 2PM");
    assert.equal(formatResetCaption(at(5, 3, 59), "reset", now), "TUE 3AM");
    assert.equal(formatResetCaption(at(2, 0, 30), "reset", now), "SAT 12AM");
    assert.equal(formatResetCaption(at(2, 12, 0), "reset", now), "SAT 12PM");
});

test("both modes accept unix seconds and say now once the reset has passed", () => {
    const seconds = new Date(at(0, 11, 45)).getTime() / 1000;
    assert.equal(formatResetCaption(seconds, "reset", now), "11:45");
    assert.equal(formatResetCaption(at(0, 9, 0), "reset", now), "now");
    assert.equal(formatResetCaption(at(0, 9, 0), "remaining", now), "now");
});

test("unusable reset times produce no caption", () => {
    assert.equal(formatResetCaption(null, "reset", now), "");
    assert.equal(formatResetCaption("not a date", "reset", now), "");
    assert.equal(formatResetCaption("not a date", "remaining", now), "");
});

test("resetDisplayMode defaults to remaining", () => {
    assert.equal(resetDisplayMode("reset"), "reset");
    assert.equal(resetDisplayMode("remaining"), "remaining");
    assert.equal(resetDisplayMode(undefined), "remaining");
    assert.equal(resetDisplayMode("bogus"), "remaining");
});
