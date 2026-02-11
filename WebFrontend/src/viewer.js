// viewer.js - with color selection and marker placement
const joinForm = document.getElementById("joinForm");
const joinBtn = document.getElementById("joinBtn");
const codeInput = document.getElementById("codeInput");
const errorEl = document.getElementById("error");
const videoEl = document.getElementById("remoteVideo");
const notifyBtn = document.getElementById("notifyBtn");
const streamContainer = document.getElementById("streamContainer");

// Color selection buttons
const redBtn = document.getElementById("redBtn");
const blueBtn = document.getElementById("blueBtn");
const greenBtn = document.getElementById("greenBtn");

let ws, pc;
let currentCode = null;
let selectedColor = null; // null, 'red', 'blue', or 'green'

const colorMap = {
    red: '#ff0000',
    blue: '#4488ff',
    green: '#ffdd00'
};

joinBtn.onclick = () => {
    const code = codeInput.value.trim().toUpperCase();
    if (code.length !== 4) {
        errorEl.textContent = "Enter a valid 4-letter code.";
        return;
    }
    startViewer(code);
};

// Color button handlers
function setupColorButtons() {
    redBtn.addEventListener("click", () => toggleColor('red'));
    blueBtn.addEventListener("click", () => toggleColor('blue'));
    greenBtn.addEventListener("click", () => toggleColor('green'));
}

function toggleColor(color) {
    if (selectedColor === color) {
        // Deselect if clicking the same color
        selectedColor = null;
        updateButtonStates();
    } else {
        // Select new color
        selectedColor = color;
        updateButtonStates();
    }
}

function updateButtonStates() {
    // Remove 'selected' class from all buttons
    redBtn.classList.remove('selected');
    blueBtn.classList.remove('selected');
    greenBtn.classList.remove('selected');

    // Add 'selected' class to the currently selected button
    if (selectedColor === 'red') {
        redBtn.classList.add('selected');
    } else if (selectedColor === 'blue') {
        blueBtn.classList.add('selected');
    } else if (selectedColor === 'green') {
        greenBtn.classList.add('selected');
    }
}

function startViewer(code) {
    currentCode = code;
    joinForm.style.display = "none";
    streamContainer.style.display = "flex";

    // Setup color buttons
    setupColorButtons();

    ws = new WebSocket(`wss://honoursthesisstreambackend.onrender.com?role=viewer&code=${code}`);

    ws.onopen = () => {
        console.log("Viewer connected (WS open)");
        ws.send(JSON.stringify({ type: "join", role: "viewer", code }));
    };

    // Notify button handler
    notifyBtn.addEventListener("click", () => {
        if (ws?.readyState === WebSocket.OPEN) {
            console.log("Viewer pressed notify button!");
            ws.send(JSON.stringify({
                type: "viewerMessage",
                code: currentCode,
                message: "Viewer pressed the notify button!"
            }));

            // Visual feedback
            notifyBtn.style.transform = 'scale(0.9)';
            setTimeout(() => {
                notifyBtn.style.transform = 'scale(1)';
            }, 200);
        } else {
            console.warn("Connection not ready yet!");
        }
    });

    // Marker placement on video click
    videoEl.addEventListener("click", (event) => {
        if (ws?.readyState !== WebSocket.OPEN) {
            console.warn("Connection not ready yet!");
            return;
        }

        // Check if a color is selected
        if (!selectedColor) {
            console.warn("No color selected - please select a marker color first");
            return;
        }

        // Get click coordinates relative to video element
        const rect = videoEl.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Calculate percentage position (so it works regardless of video size)
        const xPercent = (x / rect.width) * 100;
        const yPercent = (y / rect.height) * 100;

        console.log(`Viewer clicked at: ${xPercent.toFixed(2)}%, ${yPercent.toFixed(2)}% with color ${selectedColor}`);

        // Send marker placement to broadcaster
        ws.send(JSON.stringify({
            type: "viewerMessage",
            code: currentCode,
            message: `${selectedColor.toUpperCase()} marker placed at ${xPercent.toFixed(1)}%, ${yPercent.toFixed(1)}%`,
            markerData: {
                xPercent: xPercent,
                yPercent: yPercent,
                color: selectedColor
            }
        }));

        // Visual feedback for viewer
        showLocalMarker(x + rect.left, y + rect.top, selectedColor);
    });

    ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        console.log("Viewer WS message:", msg.type, msg);

        if (msg.type === "error") {
            errorEl.textContent = msg.message;
            joinForm.style.display = "flex";
            streamContainer.style.display = "none";
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
                    console.log("viewer: sending local ICE candidate");
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
                console.log("viewer: adding remote candidate");
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                } catch (err) {
                    console.error("viewer: addIceCandidate failed:", err);
                }
            }
        } else if (msg.type === "broadcaster-disconnected") {
            console.log("Broadcaster disconnected");
            joinForm.style.display = "flex";
            streamContainer.style.display = "none";
            errorEl.textContent = "Broadcaster ended the stream.";
            if (pc) {
                pc.close();
                pc = null;
            }
        }
    };

    ws.onerror = (e) => console.error("Viewer WS error:", e);
    ws.onclose = () => {
        console.log("Viewer WS closed");
        joinForm.style.display = "flex";
        streamContainer.style.display = "none";
        errorEl.textContent = "Connection closed. Please try again.";
    };
}

// Show temporary visual marker on viewer's side with color
function showLocalMarker(x, y, color) {
    const marker = document.createElement("div");
    marker.className = "local-marker";
    marker.style.position = "fixed";
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    marker.style.backgroundColor = colorMap[color];

    document.body.appendChild(marker);

    // Remove marker after 3 seconds
    setTimeout(() => {
        marker.style.transition = "opacity 0.5s ease";
        marker.style.opacity = "0";
        setTimeout(() => marker.remove(), 500);
    }, 3000);
}