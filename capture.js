const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const videoEl = document.getElementById("preview");
let stream;
let pc;
let ws;
const pcs = new Map(); // Map<viewerId, RTCPeerConnection>

startBtn.addEventListener("click", async () => {
    try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        videoEl.srcObject = stream;
        startBtn.disabled = true;
        stopBtn.disabled = false;

        ws = new WebSocket("ws://localhost:8080?role=broadcaster");

        ws.onmessage = async (event) => {
            const msg = JSON.parse(event.data);

            if (msg.type === "viewer-joined") {
                console.log("Viewer joined:", msg.id);
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
                    console.log("Viewer disconnected:", msg.id);
                }
            }
        };
    } catch (err) {
        console.error("Capture failed:", err);
    }
});

async function createOffer(viewerId) {
    const pc = new RTCPeerConnection();
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

