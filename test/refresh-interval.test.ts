import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_REFRESH_MINUTES, refreshIntervalMinutes } from "../src/utils/refresh-interval.ts";

test("refreshIntervalMinutes keeps whole minutes within range", () => {
    assert.equal(refreshIntervalMinutes(1), 1);
    assert.equal(refreshIntervalMinutes(30), 30);
    assert.equal(refreshIntervalMinutes(60), 60);
    assert.equal(refreshIntervalMinutes(4.6), 5);
});

test("refreshIntervalMinutes clamps out-of-range values", () => {
    assert.equal(refreshIntervalMinutes(0), 1);
    assert.equal(refreshIntervalMinutes(-5), 1);
    assert.equal(refreshIntervalMinutes(600), 60);
});

test("refreshIntervalMinutes accepts numeric strings", () => {
    assert.equal(refreshIntervalMinutes("10"), 10);
});

test("refreshIntervalMinutes falls back to the default for unusable values", () => {
    for (const value of [undefined, null, "", "abc", NaN, Infinity, {}]) {
        assert.equal(refreshIntervalMinutes(value), DEFAULT_REFRESH_MINUTES, String(value));
    }
});
