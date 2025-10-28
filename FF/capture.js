const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const videoEl = document.getElementById("preview");
let stream;

startBtn.addEventListener("click", async () => {
    try {
        console.log("Requesting display media...");
        stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false
        });
        videoEl.srcObject = stream;
        startBtn.disabled = true;
        stopBtn.disabled = false;

        stream.getVideoTracks()[0].onended = () => {
            console.log("Screen sharing stopped by user.");
            videoEl.srcObject = null;
            startBtn.disabled = false;
            stopBtn.disabled = true;
        };
    } catch (err) {
        console.error("Capture failed:", err);
        alert("Failed to start screen capture: " + err.message);
    }
});

stopBtn.addEventListener("click", () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        videoEl.srcObject = null;
        startBtn.disabled = false;
        stopBtn.disabled = true;
    }
});
