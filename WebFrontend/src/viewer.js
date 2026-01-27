// viewer.js (modified with click-to-place functionality)
const joinForm = document.getElementById("joinForm");
const joinBtn = document.getElementById("joinBtn");
const codeInput = document.getElementById("codeInput");
const errorEl = document.getElementById("error");
const videoEl = document.getElementById("remoteVideo");
const notifyBtn = document.getElementById("notifyBtn");
const streamContainer = document.getElementById("streamContainer");
const action1Btn = document.getElementById("action1Btn");
const action2Btn = document.getElementById("action2Btn");
const action3Btn = document.getElementById("action3Btn");

let ws, pc;
let currentCode = null;
let selectedTool = null; // Track which button is selected

// Button selection handlers
const toolButtons = [action1Btn, action2Btn, action3Btn];

function selectTool(button, toolName) {
    // Deselect all buttons
    toolButtons.forEach(btn => btn.classList.remove('selected'));

    // Select the clicked button
    if (selectedTool === toolName) {
        // Clicking the same button deselects it
        selectedTool = null;
    } else {
        button.classList.add('selected');
        selectedTool = toolName;
        console.log(`Tool selected: ${toolName}`);
    }
}

action1Btn.addEventListener("click", () => selectTool(action1Btn, "tool1"));
action2Btn.addEventListener("click", () => selectTool(action2Btn, "tool2"));
action3Btn.addEventListener("click", () => selectTool(action3Btn, "tool3"));

// Video click handler for placing notifications
videoEl.addEventListener("click", (event) => {
    if (!selectedTool) {
        console.log("No tool selected. Please select a button first.");
        return;
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket not connected");
        return;
    }

    // Get the click coordinates relative to the video element
    const rect = videoEl.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Calculate percentage position (so it scales with different screen sizes)
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;

    console.log(`Video clicked at: ${x}, ${y} (${xPercent.toFixed(2)}%, ${yPercent.toFixed(2)}%)`);

    // Send notification with position and tool type
    const message = {
        type: "viewerMessage",
        code: currentCode,
        message: `Tool ${selectedTool} placed at position`,
        tool: selectedTool,
        position: {
            xPercent: xPercent.toFixed(2),
            yPercent: yPercent.toFixed(2),
            x: Math.round(x),
            y: Math.round(y)
        }
    };

    ws.send(JSON.stringify(message));
    console.log("Sent position notification:", message);

    // Visual feedback - create a temporary marker on the video
    createTemporaryMarker(xPercent, yPercent, selectedTool);
});

// Create a temporary visual marker to show where the user clicked
function createTemporaryMarker(xPercent, yPercent, tool) {
    const marker = document.createElement('div');
    marker.className = 'video-marker';
    marker.style.left = `${xPercent}%`;
    marker.style.top = `${yPercent}%`;

    // Different colors for different tools
    const colors = {
        'tool1': '#4CAF50',
        'tool2': '#2196F3',
        'tool3': '#FF9800'
    };
    marker.style.borderColor = colors[tool] || '#fff';

    const videoWrapper = document.getElementById('videoWrapper');
    videoWrapper.appendChild(marker);

    // Remove marker after animation
    setTimeout(() => {
        marker.remove();
    }, 1500);
}

joinBtn.onclick = () => {
    const code = codeInput.value.trim().toUpperCase();
    if (code.length !== 4) {
        errorEl.textContent = "Enter a valid 4-letter code.";
        return;
    }
    startViewer(code);
};

// Allow Enter key to join
codeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        joinBtn.click();
    }
});

function startViewer(code) {
    currentCode = code;

    // Hide join form and show stream container
    joinForm.style.display = "none";
    streamContainer.style.display = "block";

    // Use your Render backend (secure). For pure LAN testing replace with ws://<backend-lan-ip>:8080
    ws = new WebSocket(`wss://honoursthesisstreambackend.onrender.com?role=viewer&code=${code}`);

    ws.onopen = () => {
        console.log("Viewer connected (WS open)");
        ws.send(JSON.stringify({ type: "join", role: "viewer", code }));
    };

    notifyBtn.addEventListener("click", () => {
        if (ws?.readyState === WebSocket.OPEN) {
            console.log("Viewer pressed notify button!");
            ws.send(JSON.stringify({
                type: "viewerMessage",
                code,
                message: "Viewer pressed the notify button!"
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
            // Show join form again on error
            joinForm.style.display = "flex";
            streamContainer.style.display = "none";
            return;
        }
        if (msg.type === "offer") {
            const ICE_CONFIG = { iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] };

            pc = new RTCPeerConnection(ICE_CONFIG);

            pc.oniceconnectionstatechange = () => console.log("viewer pc.iceConnectionState:", pc.iceConnectionState);
            pc.onconnectionstatechange = () => console.log("viewer pc.connectionState:", pc.connectionState);

            const videoEl = document.getElementById("remoteVideo");
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
        }
        else if (msg.type === "candidate") {
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
        // Optionally show join form again when connection closes
    };
}