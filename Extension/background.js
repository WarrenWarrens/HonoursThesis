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
    // NEW: forward marker to whatever tab the streamer is on
    if (msg.type === "show_marker_on_tab") {
        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            if (tabs.length > 0) {
                browser.tabs.sendMessage(tabs[0].id, msg).catch((err) => {
                    console.warn("Could not send marker to active tab:", err);
                });
            }
        });
    }
});

