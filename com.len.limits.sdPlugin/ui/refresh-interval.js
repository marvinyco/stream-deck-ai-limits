// Plugin-wide refresh interval slider, shared by every settings page.
// Each page calls RefreshInterval.attach(websocket, uuid) once its socket is
// registered; the value lives in global settings, so every action follows it.
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
        const host = document.getElementById("refreshInterval");
        if (!host || host.childElementCount) return;
        host.innerHTML =
            '<sdpi-item label="Refresh every">' +
            '  <div class="refresh-row">' +
            '    <input id="refreshIntervalRange" type="range" min="' + MIN + '" max="' + MAX + '" step="1" value="' + DEFAULT + '" disabled />' +
            '    <span id="refreshIntervalValue" class="refresh-value">' + describe(DEFAULT) + '</span>' +
            '  </div>' +
            '</sdpi-item>' +
            '<div class="refresh-note">Refresh interval applies to all keys of this plugin.</div>';

        const style = document.createElement("style");
        style.textContent =
            ".refresh-row { display: flex; align-items: center; gap: 8px; }" +
            ".refresh-row input { flex: 1; min-width: 0; }" +
            ".refresh-value { min-width: 44px; text-align: right; font-size: 12px; color: #ddd; }" +
            ".refresh-note { padding: 0 16px 8px; font-size: 11px; color: #999; line-height: 1.4; }";
        document.head.appendChild(style);

        const range = document.getElementById("refreshIntervalRange");
        range.addEventListener("input", function () {
            show(clamp(range.value));
        });
        range.addEventListener("change", function () {
            save(clamp(range.value));
        });
    }

    function show(minutes) {
        const range = document.getElementById("refreshIntervalRange");
        const label = document.getElementById("refreshIntervalValue");
        if (range) range.value = String(minutes);
        if (label) label.textContent = describe(minutes);
    }

    // setGlobalSettings replaces the whole object, and the plugin writes other keys
    // there (e.g. the CodexBar server config), so re-read before every save and
    // merge into the fresh copy rather than writing back a stale one.
    function save(minutes) {
        pending = minutes;
        show(minutes);
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
            if (data.event === "didReceiveGlobalSettings") {
                const settings = data.payload?.settings || {};
                if (pending !== null) {
                    socket.send(JSON.stringify({
                        event: "setGlobalSettings",
                        context: context,
                        payload: Object.assign({}, settings, { refreshIntervalMinutes: pending })
                    }));
                    pending = null;
                    return;
                }
                show(clamp(settings.refreshIntervalMinutes ?? DEFAULT));
                // Enabled only now, so the slider never starts from the default value.
                const range = document.getElementById("refreshIntervalRange");
                if (range) range.disabled = false;
            }
        });

        socket.send(JSON.stringify({ event: "getGlobalSettings", context: uuid }));
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", render);
    } else {
        render();
    }

    window.RefreshInterval = { attach: attach };
})();
