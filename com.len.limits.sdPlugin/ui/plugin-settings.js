// Plugin-wide settings shared by every settings page: the refresh interval and
// whether reset times show as a countdown or a clock time. Each page calls
// PluginSettings.attach(websocket, uuid) once its socket is registered; the values
// live in global settings, so every action follows them.
(function () {
    const MIN = 1;
    const MAX = 60;
    const DEFAULT = 15;

    let socket = null;
    let context = null;
    let pending = null;

    function clamp(value) {
        const minutes = Number(value);
        if (!Number.isFinite(minutes)) return DEFAULT;
        return Math.min(MAX, Math.max(MIN, Math.round(minutes)));
    }

    function describe(minutes) {
        return minutes === 60 ? "1 hour" : minutes + " min";
    }

    function render() {
        const host = document.getElementById("pluginSettings");
        if (!host || host.childElementCount) return;
        host.innerHTML =
            '<sdpi-item label="Refresh every">' +
            '  <div class="refresh-row">' +
            '    <input id="refreshIntervalRange" type="range" min="' + MIN + '" max="' + MAX + '" step="1" value="' + DEFAULT + '" disabled />' +
            '    <span id="refreshIntervalValue" class="refresh-value">' + describe(DEFAULT) + '</span>' +
            '  </div>' +
            '</sdpi-item>' +
            '<sdpi-item label="Show">' +
            '  <select id="resetDisplay" class="plugin-select" disabled>' +
            '    <option value="remaining">Time remaining (2h 30m)</option>' +
            '    <option value="reset">Reset time (14:30, MON 2PM)</option>' +
            '  </select>' +
            '</sdpi-item>' +
            '<div class="refresh-note">These two settings apply to all keys of this plugin.</div>';

        const style = document.createElement("style");
        style.textContent =
            ".refresh-row { display: flex; align-items: center; gap: 8px; }" +
            ".refresh-row input { flex: 1; min-width: 0; }" +
            ".refresh-value { min-width: 44px; text-align: right; font-size: 12px; color: #ddd; }" +
            ".plugin-select { width: 100%; padding: 4px 8px; border-radius: 4px; background: #2d2d2d; color: #ddd; border: 1px solid #444; font-size: 12px; }" +
            ".refresh-note { padding: 0 16px 8px; font-size: 11px; color: #999; line-height: 1.4; }";
        document.head.appendChild(style);

        const range = document.getElementById("refreshIntervalRange");
        range.addEventListener("input", function () {
            showInterval(clamp(range.value));
        });
        range.addEventListener("change", function () {
            save({ refreshIntervalMinutes: clamp(range.value) });
        });
        document.getElementById("resetDisplay").addEventListener("change", function (evt) {
            save({ resetDisplay: evt.target.value === "reset" ? "reset" : "remaining" });
        });
    }

    function showInterval(minutes) {
        const range = document.getElementById("refreshIntervalRange");
        const label = document.getElementById("refreshIntervalValue");
        if (range) range.value = String(minutes);
        if (label) label.textContent = describe(minutes);
    }

    function show(settings) {
        showInterval(clamp(settings.refreshIntervalMinutes ?? DEFAULT));
        const select = document.getElementById("resetDisplay");
        if (select) select.value = settings.resetDisplay === "reset" ? "reset" : "remaining";
    }

    // setGlobalSettings replaces the whole object, and the plugin writes other keys
    // there (e.g. the CodexBar server config), so re-read before every save and
    // merge into the fresh copy rather than writing back a stale one.
    function save(changes) {
        pending = Object.assign({}, pending, changes);
        if (socket && context) {
            socket.send(JSON.stringify({ event: "getGlobalSettings", context: context }));
        }
    }

    function attach(websocket, uuid) {
        socket = websocket;
        context = uuid;
        render();

        socket.addEventListener("message", function (evt) {
            const data = JSON.parse(evt.data);
            if (data.event !== "didReceiveGlobalSettings") return;

            const settings = data.payload?.settings || {};
            if (pending !== null) {
                socket.send(JSON.stringify({
                    event: "setGlobalSettings",
                    context: context,
                    payload: Object.assign({}, settings, pending)
                }));
                pending = null;
                return;
            }
            show(settings);
            // Enabled only now, so the controls never start from the defaults.
            ["refreshIntervalRange", "resetDisplay"].forEach(function (id) {
                const control = document.getElementById(id);
                if (control) control.disabled = false;
            });
        });

        socket.send(JSON.stringify({ event: "getGlobalSettings", context: uuid }));
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", render);
    } else {
        render();
    }

    window.PluginSettings = { attach: attach };
})();
