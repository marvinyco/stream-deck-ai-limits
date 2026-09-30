import { test } from "node:test";
import assert from "node:assert/strict";
import {
    normalizePath,
    profilesFetchKey,
    resolveProfiles,
    settleProfiles,
    toProfileGroups
} from "../src/utils/claude-profiles.ts";

const usage = (perModel: Record<string, any>): any => ({
    provider: "claude",
    overallUsagePercent: null,
    overallResetTime: null,
    perModel
});
const failed = (message: string): any => ({
    provider: "claude",
    overallUsagePercent: null,
    overallResetTime: null,
    error: { code: "AUTH", message }
});
const fmt = (resetTime: string) => `in ${resetTime}`;

test("resolveProfiles applies default labels and empty paths", () => {
    assert.deepEqual(resolveProfiles(undefined), [
        { label: "WORK", credentialsPath: "" },
        { label: "PERSONAL", credentialsPath: "" }
    ]);
});

test("resolveProfiles trims labels and falls back on blank ones", () => {
    const [work, personal] = resolveProfiles({
        profiles: [{ label: "  Acme  ", credentialsPath: " /a/.credentials.json " }, { label: "   " }]
    });
    assert.deepEqual(work, { label: "Acme", credentialsPath: "/a/.credentials.json" });
    assert.deepEqual(personal, { label: "PERSONAL", credentialsPath: "" });
});

test("normalizePath strips surrounding quotes", () => {
    const path = "C:\\Users\\user\\.claude\\.credentials.json";
    assert.equal(normalizePath(`  "${path}"  `), path);
    assert.equal(normalizePath(`'${path}'`), path);
    assert.equal(normalizePath(`"${path}`), `"${path}`, "an unbalanced quote is left alone");
    assert.equal(normalizePath(undefined), "");
});

test("fetch key ignores labels and quoting", () => {
    const a = profilesFetchKey({ profiles: [{ label: "A", credentialsPath: "/x" }, { credentialsPath: "/y" }] });
    const b = profilesFetchKey({ profiles: [{ label: "B", credentialsPath: "\"/x\"" }, { credentialsPath: " /y " }] });
    const c = profilesFetchKey({ profiles: [{ credentialsPath: "/x" }, { credentialsPath: "/z" }] });
    assert.equal(a, b);
    assert.notEqual(a, c);
});

test("toProfileGroups reads current and legacy bucket keys", () => {
    const groups = toProfileGroups([
        usage({ five_hour: { usagePercent: 16, resetTime: "s" }, seven_day: { usagePercent: 92, resetTime: "w" } }),
        usage({ "5h_quota": { usagePercent: 48, resetTime: "s2" }, "7d_quota": { usagePercent: 31, resetTime: "w2" } })
    ], undefined, fmt);

    assert.deepEqual(groups, [
        { label: "WORK", bars: [{ percent: 16, caption: "in s" }, { percent: 92, caption: "in w" }] },
        { label: "PERSONAL", bars: [{ percent: 48, caption: "in s2" }, { percent: 31, caption: "in w2" }] }
    ]);
});

test("toProfileGroups marks missing or null buckets empty", () => {
    const [group] = toProfileGroups([
        usage({ "5h_quota": { usagePercent: null, resetTime: "s" } }),
        usage({})
    ], undefined, fmt);
    assert.deepEqual(group.bars, [{ empty: true }, { empty: true }]);
});

test("toProfileGroups leaves the caption out without a reset time", () => {
    const [group] = toProfileGroups([usage({ "5h_quota": { usagePercent: 5, resetTime: null } }), usage({})], undefined, fmt);
    assert.deepEqual(group.bars?.[0], { percent: 5, caption: undefined });
});

test("one errored profile does not hide the other", () => {
    const groups = toProfileGroups([
        failed("Login Expired"),
        usage({ "5h_quota": { usagePercent: 10, resetTime: "s" } })
    ], { profiles: [{ label: "Work" }, { label: "Home" }] }, fmt);

    assert.deepEqual(groups[0], { label: "Work", error: "Login Expired" });
    assert.equal(groups[1].label, "Home");
    assert.equal(groups[1].bars?.[0].percent, 10);
});

test("settleProfiles turns a rejection into an error result", () => {
    const ok = usage({});
    const [first, second] = settleProfiles([
        { status: "fulfilled", value: ok },
        { status: "rejected", reason: new Error("EACCES: permission denied") }
    ], "claude" as any);

    assert.equal(first, ok);
    assert.equal(second.error?.message, "EACCES: permission denied");
    assert.equal(second.overallUsagePercent, null);
});

test("settleProfiles describes a non-Error rejection", () => {
    const [first, second] = settleProfiles([
        { status: "rejected", reason: "boom" },
        { status: "rejected", reason: undefined }
    ], "claude" as any);
    assert.equal(first.error?.message, "boom");
    assert.equal(second.error?.message, "Fetch Failed");
});

const win = { platform: "win32", defaultPath: "C:\\Users\\user\\.claude\\.credentials.json" };

test("an explicit path to the default login shares the default provider", () => {
    assert.equal(normalizePath("C:\\Users\\user\\.claude\\.credentials.json", win), "");
    assert.equal(normalizePath("\"c:/users/user/.claude/.credentials.json\"", win), "", "case, slashes and quotes do not matter on Windows");
    assert.equal(
        normalizePath("/Users/user/.claude/.credentials.json", { platform: "darwin", defaultPath: "/Users/user/.claude/.credentials.json" }),
        "/Users/user/.claude/.credentials.json",
        "on macOS the default login is the keychain, so the file is a different store"
    );
});

test("spellings of one Windows path give one fetch key", () => {
    const key = (p: string) => profilesFetchKey({ profiles: [{ credentialsPath: p }, {}] }, win);
    assert.equal(key("\\\\wsl$\\Distro\\home\\user\\.claude-alt\\.credentials.json"), key("//wsl.localhost/distro/home/user/.claude-alt/.credentials.json"));
    assert.equal(key("C:\\Users\\user\\.claude\\.credentials.json"), key(""));
});
