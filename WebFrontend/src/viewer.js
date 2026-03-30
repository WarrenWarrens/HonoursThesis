const joinForm = document.getElementById("joinForm");
const joinBtn = document.getElementById("joinBtn");
const codeInput = document.getElementById("codeInput");
const errorEl = document.getElementById("error");
const videoEl = document.getElementById("remoteVideo");
const streamContainer = document.getElementById("streamContainer");

const redBtn    = document.getElementById("redBtn");
const blueBtn   = document.getElementById("blueBtn");
const yellowBtn = document.getElementById("yellowBtn");
const greenBtn  = document.getElementById("greenBtn");

let ws, pc;
let currentCode = null;
let selectedColor = null;
let pendingBlueMarker = null;

const colorMap = {
    red:    '#ff0000',
    blue:   '#0066ff',
    yellow: '#ffdd00',
    green:  '#00cc44'
};

const markerIconMap = {
    red:    '🐛',
    blue:   '💬',
    yellow: '❓',
    green:  '✓'
};

joinBtn.onclick = () => {
    const code = codeInput.value.trim().toUpperCase();
    if (code.length !== 4) {
        errorEl.textContent = "Enter a valid 4-letter code.";
        return;
    }
    startViewer(code);
};

function setupColorButtons() {
    redBtn.addEventListener("click",    () => toggleColor('red'));
    blueBtn.addEventListener("click",   () => toggleColor('blue'));
    yellowBtn.addEventListener("click", () => toggleColor('yellow'));
    greenBtn.addEventListener("click",  () => toggleColor('green'));
}

function toggleColor(color) {
    selectedColor = selectedColor === color ? null : color;
    updateButtonStates();
}

function updateButtonStates() {
    const buttons = {
        red:    { el: redBtn,    shadow: 'rgba(255, 0, 0, 0.8)' },
        blue:   { el: blueBtn,   shadow: 'rgba(0, 102, 255, 0.8)' },
        yellow: { el: yellowBtn, shadow: 'rgba(255, 221, 0, 0.8)' },
        green:  { el: greenBtn,  shadow: 'rgba(0, 204, 68, 0.8)' }
    };

    for (const [color, { el, shadow }] of Object.entries(buttons)) {
        const active = selectedColor === color;
        el.style.opacity = active || selectedColor === null ? '1' : '0.5';
        el.style.transform = active ? 'scale(1.1)' : 'scale(1)';
        el.style.boxShadow = active ? `0 0 15px ${shadow}` : 'none';
    }
}

function startViewer(code) {
    currentCode = code;
    joinForm.style.display = "none";
    streamContainer.style.display = "flex";

    setupColorButtons();

    ws = new WebSocket(`wss://honoursthesisstreambackend.onrender.com?role=viewer&code=${code}`);

    ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", role: "viewer", code }));
    };

    videoEl.addEventListener("click", (event) => {
        if (ws?.readyState !== WebSocket.OPEN || !selectedColor) return;

        const rect = videoEl.getBoundingClientRect();
        const xPercent = ((event.clientX - rect.left) / rect.width) * 100;
        const yPercent = ((event.clientY - rect.top) / rect.height) * 100;

        if (selectedColor === 'blue') {
            pendingBlueMarker = { xPercent, yPercent, absX: event.clientX, absY: event.clientY };
            showBluePopup();
            return;
        }

        sendMarker(xPercent, yPercent, selectedColor, null, event.clientX, event.clientY);
    });

    ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "error") {
            errorEl.textContent = msg.message;
            joinForm.style.display = "flex";
            streamContainer.style.display = "none";
            return;
        }

        if (msg.type === "offer") {
            const ICE_CONFIG = {
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "turn:openrelay.metered.ca:80",              username: "openrelayproject", credential: "openrelayproject" },
                    { urls: "turn:openrelay.metered.ca:443",             username: "openrelayproject", credential: "openrelayproject" },
                    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
                ]
            };

            pc = new RTCPeerConnection(ICE_CONFIG);
            let remoteStream = new MediaStream();

            pc.ontrack = (event) => {
                remoteStream.addTrack(event.track);
                videoEl.srcObject = remoteStream;
                videoEl.muted = true;
                videoEl.play().catch(err => console.warn("autoplay blocked:", err));
            };

            pc.onconnectionstatechange  = () => console.log("viewer connectionState:", pc.connectionState);
            pc.oniceconnectionstatechange = () => console.log("viewer iceConnectionState:", pc.iceConnectionState);

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
                }
            };

            try {
                await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                ws.send(JSON.stringify({ type: "answer", answer }));
            } catch (err) {
                console.error("viewer: error handling offer:", err);
            }

        } else if (msg.type === "candidate") {
            if (pc) {
                try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); }
                catch (err) { console.error("addIceCandidate failed:", err); }
            }
        } else if (msg.type === "broadcaster-disconnected") {
            joinForm.style.display = "flex";
            streamContainer.style.display = "none";
            errorEl.textContent = "Broadcaster ended the stream.";
            if (pc) { pc.close(); pc = null; }
        }
    };

    ws.onerror = (e) => console.error("Viewer WS error:", e);
    ws.onclose = () => {
        joinForm.style.display = "flex";
        streamContainer.style.display = "none";
        errorEl.textContent = "Connection closed. Please try again.";
    };
}

function sendMarker(xPercent, yPercent, color, message, absX, absY) {
    ws.send(JSON.stringify({
        type: "viewerMessage",
        code: currentCode,
        message: message || `${color.toUpperCase()} marker at ${xPercent.toFixed(1)}%, ${yPercent.toFixed(1)}%`,
        markerData: { xPercent, yPercent, color }
    }));
    showLocalMarker(absX, absY, color);
}

function showLocalMarker(x, y, color) {
    const marker = document.createElement("div");
    marker.className = "local-marker";
    marker.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        background-color: ${colorMap[color]};
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    const icon = document.createElement("span");
    icon.textContent = markerIconMap[color] || '●';
    icon.style.cssText = "font-size: 14px; line-height: 1; pointer-events: none;";
    marker.appendChild(icon);

    document.body.appendChild(marker);

    setTimeout(() => {
        marker.style.transition = "opacity 0.5s ease";
        marker.style.opacity = "0";
        setTimeout(() => marker.remove(), 500);
    }, 3000);
}

function showBluePopup() {
    const popup    = document.getElementById("bluePopup");
    const input    = document.getElementById("bluePopupInput");
    const charCount = document.getElementById("bluePopupCharCount");
    const sendBtn  = document.getElementById("bluePopupSend");

    input.value = "";
    charCount.textContent = "0 / 50";
    sendBtn.disabled = false;
    popup.style.display = "flex";
    input.focus();

    input.oninput = () => {
        charCount.textContent = `${input.value.length} / 50`;
    };

    document.getElementById("bluePopupCancel").onclick = () => {
        popup.style.display = "none";
        pendingBlueMarker = null;
    };

    sendBtn.onclick = submitBlueMarker;

    input.onkeydown = (e) => {
        if (e.key === "Enter")  submitBlueMarker();
        if (e.key === "Escape") { popup.style.display = "none"; pendingBlueMarker = null; }
    };
}

function submitBlueMarker() {
    const input = document.getElementById("bluePopupInput");
    const text = input.value.trim();
    if (!text || !pendingBlueMarker) return;

    document.getElementById("bluePopup").style.display = "none";
    const { xPercent, yPercent, absX, absY } = pendingBlueMarker;
    pendingBlueMarker = null;
    sendMarker(xPercent, yPercent, 'blue', text, absX, absY);
}