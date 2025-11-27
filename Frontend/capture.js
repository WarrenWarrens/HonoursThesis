const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const videoEl = document.getElementById("preview");
let stream, ws;
const pcs = new Map();

const overlay = document.getElementById("overlay-container");
const overlayHeader = document.getElementById("overlay-header");
let offsetX = 0, offsetY = 0, isDragging = false;

overlayHeader.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - overlay.offsetLeft;
    offsetY = e.clientY - overlay.offsetTop;
    overlay.style.cursor = "grabbing";
});

document.addEventListener("mouseup", () => {
    isDragging = false;
    overlay.style.cursor = "grab";
});

document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    overlay.style.left = (e.clientX - offsetX) + "px";
    overlay.style.top = (e.clientY - offsetY) + "px";
});

startBtn.addEventListener("click", async () => {
    try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        videoEl.srcObject = stream;
        startBtn.disabled = true;
        stopBtn.disabled = false;

        ws = new WebSocket("wss://honoursthesisstreambackend.onrender.com?role=broadcaster");

        ws.addEventListener("open", () => {
            console.log("Broadcaster connected");
        });

        ws.addEventListener("message", async (event) => {
            const msg = JSON.parse(event.data);

            if (msg.type === "room-code") {
                alert(`Your stream code is: ${msg.code}`);
            } else if (msg.type === "viewer-joined") {
                await createOffer(msg.id);
            } else if (msg.type === "answer") {
                const pc = pcs.get(msg.id);
                if (pc) await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
            } else if (msg.type === "candidate") {
                const pc = pcs.get(msg.id);
                if (pc) await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } else if (msg.type === "viewer-left") {
                const pc = pcs.get(msg.id);
                if (pc) {
                    pc.close();
                    pcs.delete(msg.id);
                }
            } else if (msg.type === "viewer_notify") {
                console.log("Viewer notification:", msg.message);
                showMessageOverlay(msg.message);
            }
        });

        stream.getVideoTracks()[0].onended = stopCapture;
    } catch (err) {
        console.error("Capture failed:", err);
        alert("Failed to start screen capture: " + err.message);
    }
});

async function createOffer(viewerId) {
    const ICE_SERVERS = {
        iceServers: [{
            urls: [ "stun:us-turn3.xirsys.com" ]
        }, {
            username: "nKr-LEorDuJH2cS1BS-YwjffBRrWL4i2iHIhdlCh1H1fzWqFxfb0Wo_S4_Ne34HdAAAAAGkWF8ZSV2FycmVu",
            credential: "ae75724a-c0b7-11f0-a466-0242ac140004",
            urls: [
                "turn:us-turn3.xirsys.com:80?transport=udp",
                "turn:us-turn3.xirsys.com:3478?transport=udp",
                "turn:us-turn3.xirsys.com:80?transport=tcp",
                "turn:us-turn3.xirsys.com:3478?transport=tcp",
                "turns:us-turn3.xirsys.com:443?transport=tcp",
                "turns:us-turn3.xirsys.com:5349?transport=tcp"
            ]
        }]


    };

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pcs.set(viewerId, pc);

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: "candidate", id: viewerId, candidate: event.candidate }));
        }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: "offer", id: viewerId, offer }));
}

function stopCapture() {
    stream?.getTracks().forEach(track => track.stop());
    videoEl.srcObject = null;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    for (const [, pc] of pcs) pc.close();
    pcs.clear();
    ws?.close();
}

stopBtn.addEventListener("click", stopCapture);

function showNotificationPopup(message) {
    const popup = document.getElementById("notify-popup");
    if (!popup) return;
    popup.textContent = message || "Viewer sent a notification!";
    popup.style.display = "block";
    setTimeout(() => (popup.style.display = "none"), 3000);
}

let hideTimeout;

function showMessageOverlay(text) {
    const box = document.getElementById("overlay-container");
    const content = document.getElementById("overlay-content");

    content.textContent = text;

    box.style.display = "block";

    // Expand to fit content
    box.style.width = "auto";
    box.style.height = "auto";

    // Reset hide timer
    if (hideTimeout) clearTimeout(hideTimeout);

    hideTimeout = setTimeout(() => {
        box.style.display = "none";
    }, 5000);
}
