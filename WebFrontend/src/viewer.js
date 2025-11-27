// viewer.js (replace whole file)
const joinForm = document.getElementById("joinForm");
const joinBtn = document.getElementById("joinBtn");
const codeInput = document.getElementById("codeInput");
const errorEl = document.getElementById("error");
const videoEl = document.getElementById("remoteVideo");
const notifyBtn = document.getElementById("notifyBtn");
let ws, pc;

joinBtn.onclick = () => {
    const code = codeInput.value.trim().toUpperCase();
    if (code.length !== 4) {
        errorEl.textContent = "Enter a valid 4-letter code.";
        return;
    }
    startViewer(code);
};

function startViewer(code) {
    joinForm.style.display = "none";
    videoEl.style.display = "block";

    // Use your Render backend (secure). For pure LAN testing replace with ws://<backend-lan-ip>:8080
    ws = new WebSocket(`wss://honoursthesisstreambackend.onrender.com?role=viewer&code=${code}`);

    ws.onopen = () => {
        console.log("Viewer connected (WS open)");
        ws.send(JSON.stringify({ type: "join", role: "viewer", code }));
    };

    notifyBtn.addEventListener("click", () => {
        if (ws?.readyState === WebSocket.OPEN) {
            console.log("Viewer pressed button!");
            ws.send(JSON.stringify({
                type: "viewerMessage",
                code,
                message: "Viewer pressed the button!"
            }));
            alert("Notification sent to the streamer!");
        } else {
            alert("Connection not ready yet!");
        }
    });

    ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        console.log("Viewer WS message:", msg.type, msg);

        if (msg.type === "error") {
            errorEl.textContent = msg.message;
            joinForm.style.display = "flex";
            videoEl.style.display = "none";
            return;
        }

        if (msg.type === "offer") {
            // STUN-only for LAN testing (simple and reliable on same wifi)
            const ICE_CONFIG = { iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] };

            // Important: assign to outer-scoped pc variable
            pc = new RTCPeerConnection(ICE_CONFIG);

            pc.ontrack = (event) => {
                console.log("viewer: got track, streams:", event.streams);
                videoEl.srcObject = event.streams[0];
            };

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log("viewer: sending local ICE candidate", event.candidate);
                    ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
                }
            };

            pc.oniceconnectionstatechange = () => console.log("viewer pc.iceConnectionState:", pc.iceConnectionState);
            pc.onconnectionstatechange = () => console.log("viewer pc.connectionState:", pc.connectionState);

            try {
                await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                ws.send(JSON.stringify({ type: "answer", answer }));
                console.log("viewer: answered offer");
            } catch (err) {
                console.error("viewer: error handling offer:", err);
            }
        } else if (msg.type === "candidate") {
            if (!pc) {
                console.warn("viewer: received candidate but pc is not ready yet");
            } else {
                console.log("viewer: adding remote candidate", msg.candidate);
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                } catch (err) {
                    console.error("viewer: addIceCandidate failed:", err);
                }
            }
        } else if (msg.type === "broadcaster-disconnected") {
            alert("Broadcaster ended the stream.");
            videoEl.srcObject = null;
        }
    };

    ws.onerror = (e) => console.error("Viewer WS error:", e);
    ws.onclose = () => console.log("Viewer WS closed");
}
