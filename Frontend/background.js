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
});

