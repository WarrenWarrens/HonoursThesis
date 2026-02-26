// console.log("Firefox Screen Streamer background running...");
// ws.addEventListener("message", (event) => {
//     const msg = JSON.parse(event.data);
//
//     if (msg.type === "viewer_notify") {
//         showNotificationPopup();
//     }
//
//     // existing message handling (offer, candidate, etc.)
// });
//
// function showNotificationPopup() {
//     browser.notifications.create({
//         "type": "basic",
//         "iconUrl": "icons/icon.png",
//         "title": "Viewer Interaction",
//         "message": "A viewer pressed the notify button!"
//     });
// }

console.log("Firefox Screen Streamer background running...");
browser.runtime.onMessage.addListener((msg) => {

    if (msg.type === "viewer_notify") {
        browser.notifications.create({
            type: "basic",
            iconUrl: "icons/icon.png",
            title: "Viewer Interaction",
            message: "A viewer pressed the notify button!"
        });
    }

    if (msg.type === "FORWARD_MARKER_TO_TAB") {
        browser.tabs.query({ active: true, lastFocusedWindow: true }).then((tabs) => {
            if (!tabs.length) return;

            const tabId = tabs[0].id;
            const payload = {
                type: "SHOW_MARKER",
                data: msg.data,
                message: msg.message
            };

            browser.tabs.sendMessage(tabId, payload).catch(() => {
                // Content script not loaded yet — inject it, then retry
                browser.tabs.executeScript(tabId, { file: "content_script.js" })
                    .then(() => {
                        setTimeout(() => {
                            browser.tabs.sendMessage(tabId, payload).catch(err => {
                                console.error("Still failed after injection:", err);
                            });
                        }, 100);
                    })
                    .catch(err => {
                        console.error("Injection failed (restricted tab):", err);
                    });
            });
        });
    }

});
//
// browser.runtime.onMessage.addListener((msg) => {
//     if (msg.type === "viewer_notify") {
//         browser.notifications.create({
//             type: "basic",
//             iconUrl: "icons/icon.png",
//             title: "Viewer Interaction",
//             message: "A viewer pressed the notify button!"
//         });
//     }
//     // NEW: forward marker to whatever tab the streamer is on
//     if (msg.type === "show_marker_on_tab") {
//         browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
//             if (tabs.length > 0) {
//                 browser.tabs.sendMessage(tabs[0].id, msg).catch((err) => {
//                     console.warn("Could not send marker to active tab:", err);
//                 });
//             }
//         });
//     }
// });

