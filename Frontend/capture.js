const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const videoEl = document.getElementById("preview");
let stream, ws;
const pcs = new Map();

startBtn.addEventListener("click", async () => {
    try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        videoEl.srcObject = stream;
        startBtn.disabled = true;
        stopBtn.disabled = false;

        ws = new WebSocket("wss://honoursthesisstreambackend.onrender.com");

        ws.onmessage = async (event) => {
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
            }
        };

        stream.getVideoTracks()[0].onended = stopCapture;
    } catch (err) {
        console.error("Capture failed:", err);
        alert("Failed to start screen capture: " + err.message);
    }
});

async function createOffer(viewerId) {
    const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
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
