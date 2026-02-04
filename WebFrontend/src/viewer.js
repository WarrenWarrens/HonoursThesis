// viewer.js - with marker placement functionality
const joinForm = document.getElementById("joinForm");
const joinBtn = document.getElementById("joinBtn");
const codeInput = document.getElementById("codeInput");
const errorEl = document.getElementById("error");
const videoEl = document.getElementById("remoteVideo");
const notifyBtn = document.getElementById("notifyBtn");
const streamContainer = document.getElementById("streamContainer");

let ws, pc;
let currentCode = null;

joinBtn.onclick = () => {
    const code = codeInput.value.trim().toUpperCase();
    if (code.length !== 4) {
        errorEl.textContent = "Enter a valid 4-letter code.";
        return;
    }
    startViewer(code);
};

function startViewer(code) {
    currentCode = code;
    joinForm.style.display = "none";
    streamContainer.style.display = "flex";
    videoEl.style.display = "block";

    ws = new WebSocket(`wss://honoursthesisstreambackend.onrender.com?role=viewer&code=${code}`);

    ws.onopen = () => {
        console.log("Viewer connected (WS open)");
        ws.send(JSON.stringify({ type: "join", role: "viewer", code }));
    };

    // Simple notify button handler
    notifyBtn.addEventListener("click", () => {
        if (ws?.readyState === WebSocket.OPEN) {
            console.log("Viewer pressed notify button!");
            ws.send(JSON.stringify({
                type: "viewerMessage",
                code: currentCode,
                message: "Viewer pressed the notify button!"
            }));
            alert("Notification sent to the streamer!");
        } else {
            alert("Connection not ready yet!");
        }
    });

    // Marker placement on video click
    videoEl.addEventListener("click", (event) => {
        if (ws?.readyState !== WebSocket.OPEN) {
            alert("Connection not ready yet!");
            return;
        }

        // Get click coordinates relative to video element
        const rect = videoEl.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Calculate percentage position (so it works regardless of video size)
        const xPercent = (x / rect.width) * 100;
        const yPercent = (y / rect.height) * 100;

        console.log(`Viewer clicked at: ${xPercent.toFixed(2)}%, ${yPercent.toFixed(2)}%`);

        // Send marker placement to broadcaster
        ws.send(JSON.stringify({
            type: "viewerMessage",
            code: currentCode,
            message: `Marker placed at ${xPercent.toFixed(1)}%, ${yPercent.toFixed(1)}%`,
            markerData: {
                xPercent: xPercent,
                yPercent: yPercent
            }
        }));

        // Visual feedback for viewer
        showLocalMarker(x, y);
    });

    ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        console.log("Viewer WS message:", msg.type, msg);

        if (msg.type === "error") {
            errorEl.textContent = msg.message;
            joinForm.style.display = "flex";
            streamContainer.style.display = "none";
            videoEl.style.display = "none";
            return;
        }

        if (msg.type === "offer") {
            const ICE_CONFIG = { iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] };
            pc = new RTCPeerConnection(ICE_CONFIG);
            let remoteStream = new MediaStream();

            pc.ontrack = (event) => {
                console.log("viewer: got track", event.track.kind);
                remoteStream.addTrack(event.track);
                videoEl.srcObject = remoteStream;
                videoEl.muted = true;
                videoEl.play().catch(err => {
                    console.warn("viewer: autoplay blocked", err);
                });
            };

            pc.onconnectionstatechange = () => {
                console.log("viewer pc.connectionState:", pc.connectionState);
            };

            pc.oniceconnectionstatechange = () => {
                console.log("viewer pc.iceConnectionState:", pc.iceConnectionState);
            };

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log("viewer: sending local ICE candidate", event.candidate);
                    ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
                }
            };

            try {
                console.log("viewer: setting remote description (offer)...");
                await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                ws.send(JSON.stringify({ type: "answer", answer }));
                console.log("viewer: sent answer");
            } catch (err) {
                console.error("viewer: error while handling offer:", err);
            }
        } else if (msg.type === "candidate") {
            if (!pc) {
                console.warn("viewer: received candidate but pc not ready yet");
            } else {
                console.log("viewer: adding remote candidate", msg.candidate);
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                } catch (err) {
                    console.error("viewer: addIceCandidate failed:", err);
                }
            }
        }
    };

    ws.onerror = (e) => console.error("Viewer WS error:", e);
    ws.onclose = () => {
        console.log("Viewer WS closed");
        joinForm.style.display = "flex";
        streamContainer.style.display = "none";
        videoEl.style.display = "none";
        errorEl.textContent = "Connection closed. Please try again.";
    };
}

// Show temporary visual marker on viewer's side
function showLocalMarker(x, y) {
    const marker = document.createElement("div");
    marker.style.position = "absolute";
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    marker.style.width = "20px";
    marker.style.height = "20px";
    marker.style.backgroundColor = "rgba(255, 0, 0, 0.7)";
    marker.style.borderRadius = "50%";
    marker.style.border = "2px solid white";
    marker.style.transform = "translate(-50%, -50%)";
    marker.style.pointerEvents = "none";
    marker.style.zIndex = "1000";

    // Position relative to video container
    const container = streamContainer;
    container.style.position = "relative";
    container.appendChild(marker);

    // Remove marker after 2 seconds
    setTimeout(() => {
        marker.remove();
    }, 2000);
}