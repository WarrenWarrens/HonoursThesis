// document.getElementById("start").addEventListener("click", async () => {
//     try {
//         let stream;
//
//         // Chrome / Brave
//         if (chrome.desktopCapture) {
//             stream = await new Promise((resolve, reject) => {
//                 chrome.desktopCapture.chooseDesktopMedia(
//                     ["screen", "window", "tab"],
//                     streamId => {
//                         if (!streamId) return reject(new Error("User canceled"));
//
//                         navigator.mediaDevices.getUserMedia({
//                             audio: false,
//                             video: {
//                                 mandatory: {
//                                     chromeMediaSource: "desktop",
//                                     chromeMediaSourceId: streamId
//                                 }
//                             }
//                         }).then(resolve).catch(reject);
//                     }
//                 );
//             });
//         }
//         // Firefox / fallback
//         else if (navigator.mediaDevices.getDisplayMedia) {
//             stream = await navigator.mediaDevices.getDisplayMedia({
//                 video: true,
//                 audio: false
//             });
//         } else {
//             throw new Error("Screen capture not supported in this browser");
//         }
//
//         // Attach to <video>
//         const video = document.getElementById("preview");
//         video.srcObject = stream;
//         video.play();
//
//     } catch (err) {
//         console.error("Error sharing screen:", err);
//     }
// });

document.getElementById("startCapture").addEventListener("click", async () => {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false
        });

        console.log("Got stream:", stream);

        const videoEl = document.getElementById("preview");
        videoEl.srcObject = stream;

    } catch (err) {
        console.error("Error capturing screen:", err);
    }
});


console.log("Got stream:", stream);
