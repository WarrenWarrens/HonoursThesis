// // viewer.js - with color selection and marker placement
// const joinForm = document.getElementById("joinForm");
// const joinBtn = document.getElementById("joinBtn");
// const codeInput = document.getElementById("codeInput");
// const errorEl = document.getElementById("error");
// const videoEl = document.getElementById("remoteVideo");
// const notifyBtn = document.getElementById("notifyBtn");
// const streamContainer = document.getElementById("streamContainer");
//
// // Color selection buttons
// const redBtn    = document.getElementById("redBtn");
// const blueBtn   = document.getElementById("blueBtn");
// const yellowBtn = document.getElementById("yellowBtn");
// const greenBtn  = document.getElementById("greenBtn");
//
// // const greenBtn = document.getElementById("notifyBtn"); // repurpose
//
//
// let ws, pc;
// let currentCode = null;
//
//
//
//
// let selectedColor = null; // null, 'red', 'blue', or 'yellow'
// let pendingBlueMarker = null; // stores {xPercent, yPercent, absX, absY} while popup is open
//
// const colorMap = {
//     red: '#ff0000',
//     blue: '#0066ff',
//     yellow: '#ffdd00',
//     green: '#00cc44'
// };
//
// const markerIconMap = { red: '🐛', yellow: '❓', blue: '💬' };
//
// joinBtn.onclick = () => {
//     const code = codeInput.value.trim().toUpperCase();
//     if (code.length !== 4) {
//         errorEl.textContent = "Enter a valid 4-letter code.";
//         return;
//     }
//     startViewer(code);
// };
//
//
// // Color button handlers
// // function setupColorButtons() {
// //     redBtn.addEventListener("click", () => toggleColor('red'));
// //     blueBtn.addEventListener("click", () => toggleColor('blue'));
// //     greenBtn.addEventListener("click", () => toggleColor('yellow'));
// // }
//
// function setupColorButtons() {
//     redBtn.addEventListener("click", () => toggleColor('red'));
//     blueBtn.addEventListener("click", () => toggleColor('blue'));
//     document.getElementById("greenBtn").addEventListener("click", () => toggleColor('yellow')); // yellow button
//     greenBtn.addEventListener("click", () => toggleColor('green')); // notifyBtn repurposed
// }
//
// function toggleColor(color) {
//     if (selectedColor === color) {
//         selectedColor = null;
//         updateButtonStates();
//     } else {
//         selectedColor = color;
//         updateButtonStates();
//     }
// }
//
// // function updateButtonStates() {
// //     redBtn.style.opacity = selectedColor === 'red' ? '1' : '0.5';
// //     redBtn.style.transform = selectedColor === 'red' ? 'scale(1.1)' : 'scale(1)';
// //     redBtn.style.boxShadow = selectedColor === 'red' ? '0 0 15px rgba(255, 0, 0, 0.8)' : 'none';
// //
// //     blueBtn.style.opacity = selectedColor === 'blue' ? '1' : '0.5';
// //     blueBtn.style.transform = selectedColor === 'blue' ? 'scale(1.1)' : 'scale(1)';
// //     blueBtn.style.boxShadow = selectedColor === 'blue' ? '0 0 15px rgba(0, 102, 255, 0.8)' : 'none';
// //
// //     greenBtn.style.opacity = selectedColor === 'yellow' ? '1' : '0.5';
// //     greenBtn.style.transform = selectedColor === 'yellow' ? 'scale(1.1)' : 'scale(1)';
// //     greenBtn.style.boxShadow = selectedColor === 'yellow' ? '0 0 15px rgba(255, 221, 0, 0.8)' : 'none';
// // }
//
// function updateButtonStates() {
//     redBtn.style.opacity   = selectedColor === 'red'    ? '1' : '0.5';
//     redBtn.style.transform = selectedColor === 'red'    ? 'scale(1.1)' : 'scale(1)';
//     redBtn.style.boxShadow = selectedColor === 'red'    ? '0 0 15px rgba(255, 0, 0, 0.8)' : 'none';
//
//     blueBtn.style.opacity   = selectedColor === 'blue'  ? '1' : '0.5';
//     blueBtn.style.transform = selectedColor === 'blue'  ? 'scale(1.1)' : 'scale(1)';
//     blueBtn.style.boxShadow = selectedColor === 'blue'  ? '0 0 15px rgba(0, 102, 255, 0.8)' : 'none';
//
//     const yellowBtn = document.getElementById("greenBtn");
//     yellowBtn.style.opacity   = selectedColor === 'yellow' ? '1' : '0.5';
//     yellowBtn.style.transform = selectedColor === 'yellow' ? 'scale(1.1)' : 'scale(1)';
//     yellowBtn.style.boxShadow = selectedColor === 'yellow' ? '0 0 15px rgba(255, 221, 0, 0.8)' : 'none';
//
//     greenBtn.style.opacity   = selectedColor === 'green' ? '1' : '0.5';
//     greenBtn.style.transform = selectedColor === 'green' ? 'scale(1.1)' : 'scale(1)';
//     greenBtn.style.boxShadow = selectedColor === 'green' ? '0 0 15px rgba(0, 204, 68, 0.8)' : 'none';
// }
//
// function startViewer(code) {
//     currentCode = code;
//     joinForm.style.display = "none";
//     streamContainer.style.display = "flex";
//
//     // Setup color buttons
//     setupColorButtons();
//
//     ws = new WebSocket(`wss://honoursthesisstreambackend.onrender.com?role=viewer&code=${code}`);
//
//     ws.onopen = () => {
//         console.log("Viewer connected (WS open)");
//         ws.send(JSON.stringify({ type: "join", role: "viewer", code }));
//     };
//
//     // Notify button handler
//     notifyBtn.addEventListener("click", () => {
//         if (ws?.readyState === WebSocket.OPEN) {
//             console.log("Viewer pressed notify button!");
//             ws.send(JSON.stringify({
//                 type: "viewerMessage",
//                 code: currentCode,
//                 message: "Viewer pressed the notify button!"
//             }));
//
//             // Visual feedback
//             notifyBtn.style.transform = 'scale(0.9)';
//             setTimeout(() => {
//                 notifyBtn.style.transform = 'scale(1)';
//             }, 200);
//         } else {
//             console.warn("Connection not ready yet!");
//         }
//     });
//
//     // Marker placement on video click
//     // videoEl.addEventListener("click", (event) => {
//     //     if (ws?.readyState !== WebSocket.OPEN) {
//     //         console.warn("Connection not ready yet!");
//     //         return;
//     //     }
//     //
//     //     // Check if a color is selected
//     //     if (!selectedColor) {
//     //         console.warn("No color selected - please select a marker color first");
//     //         return;
//     //     }
//     //
//     //     // Get click coordinates relative to video element
//     //     const rect = videoEl.getBoundingClientRect();
//     //     const x = event.clientX - rect.left;
//     //     const y = event.clientY - rect.top;
//     //
//     //     // Calculate percentage position (so it works regardless of video size)
//     //     const xPercent = (x / rect.width) * 100;
//     //     const yPercent = (y / rect.height) * 100;
//     //
//     //     console.log(`Viewer clicked at: ${xPercent.toFixed(2)}%, ${yPercent.toFixed(2)}% with color ${selectedColor}`);
//     //
//     //     // Send marker placement to broadcaster
//     //     ws.send(JSON.stringify({
//     //         type: "viewerMessage",
//     //         code: currentCode,
//     //         message: `${selectedColor.toUpperCase()} marker placed at ${xPercent.toFixed(1)}%, ${yPercent.toFixed(1)}%`,
//     //         markerData: {
//     //             xPercent: xPercent,
//     //             yPercent: yPercent,
//     //             color: selectedColor  // will now correctly send 'yellow'
//     //         }
//     //     }));
//     //
//     //     // Visual feedback for viewer
//     //     showLocalMarker(x + rect.left, y + rect.top, selectedColor);
//     // });
//
//     videoEl.addEventListener("click", (event) => {
//         if (ws?.readyState !== WebSocket.OPEN || !selectedColor) return;
//
//         const rect = videoEl.getBoundingClientRect();
//         const x = event.clientX - rect.left;
//         const y = event.clientY - rect.top;
//         const xPercent = (x / rect.width) * 100;
//         const yPercent = (y / rect.height) * 100;
//
//         if (selectedColor === 'blue') {
//             // Store pending position, show popup instead of sending immediately
//             pendingBlueMarker = { xPercent, yPercent, absX: event.clientX, absY: event.clientY };
//             showBluePopup();
//             return;
//         }
//
//         sendMarker(xPercent, yPercent, selectedColor, null, event.clientX, event.clientY);
//     });
//
//     ws.onmessage = async (event) => {
//         const msg = JSON.parse(event.data);
//         console.log("Viewer WS message:", msg.type, msg);
//
//         if (msg.type === "error") {
//             errorEl.textContent = msg.message;
//             joinForm.style.display = "flex";
//             streamContainer.style.display = "none";
//             return;
//         }
//
//         if (msg.type === "offer") {
//             const ICE_CONFIG = {
//                 iceServers: [
//                     { urls: "stun:stun.l.google.com:19302" },
//                     {
//                         urls: "turn:openrelay.metered.ca:80",
//                         username: "openrelayproject",
//                         credential: "openrelayproject"
//                     },
//                     {
//                         urls: "turn:openrelay.metered.ca:443",
//                         username: "openrelayproject",
//                         credential: "openrelayproject"
//                     },
//                     {
//                         urls: "turn:openrelay.metered.ca:443?transport=tcp",
//                         username: "openrelayproject",
//                         credential: "openrelayproject"
//                     }
//                 ]
//             };
//             // const ICE_CONFIG = { iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] };
//             pc = new RTCPeerConnection(ICE_CONFIG);
//             let remoteStream = new MediaStream();
//
//             pc.ontrack = (event) => {
//                 console.log("viewer: got track", event.track.kind);
//                 remoteStream.addTrack(event.track);
//                 videoEl.srcObject = remoteStream;
//                 videoEl.muted = true;
//                 videoEl.play().catch(err => {
//                     console.warn("viewer: autoplay blocked", err);
//                 });
//             };
//
//             pc.onconnectionstatechange = () => {
//                 console.log("viewer pc.connectionState:", pc.connectionState);
//             };
//
//             pc.oniceconnectionstatechange = () => {
//                 console.log("viewer pc.iceConnectionState:", pc.iceConnectionState);
//             };
//
//             pc.onicecandidate = (event) => {
//                 if (event.candidate) {
//                     console.log("viewer: sending local ICE candidate");
//                     ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
//                 }
//             };
//
//             try {
//                 console.log("viewer: setting remote description (offer)...");
//                 await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
//                 const answer = await pc.createAnswer();
//                 await pc.setLocalDescription(answer);
//                 ws.send(JSON.stringify({ type: "answer", answer }));
//                 console.log("viewer: sent answer");
//             } catch (err) {
//                 console.error("viewer: error while handling offer:", err);
//             }
//         } else if (msg.type === "candidate") {
//             if (!pc) {
//                 console.warn("viewer: received candidate but pc not ready yet");
//             } else {
//                 console.log("viewer: adding remote candidate");
//                 try {
//                     await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
//                 } catch (err) {
//                     console.error("viewer: addIceCandidate failed:", err);
//                 }
//             }
//         } else if (msg.type === "broadcaster-disconnected") {
//             console.log("Broadcaster disconnected");
//             joinForm.style.display = "flex";
//             streamContainer.style.display = "none";
//             errorEl.textContent = "Broadcaster ended the stream.";
//             if (pc) {
//                 pc.close();
//                 pc = null;
//             }
//         }
//     };
//
//     ws.onerror = (e) => console.error("Viewer WS error:", e);
//     ws.onclose = () => {
//         console.log("Viewer WS closed");
//         joinForm.style.display = "flex";
//         streamContainer.style.display = "none";
//         errorEl.textContent = "Connection closed. Please try again.";
//     };
// }
//
// // NEW
//
// function showLocalMarker(x, y, color) {
//     const marker = document.createElement("div");
//     marker.className = "local-marker";
//     marker.style.position = "fixed";
//     marker.style.left = `${x}px`;
//     marker.style.top = `${y}px`;
//     marker.style.backgroundColor = colorMap[color];
//     marker.style.display = "flex";
//     marker.style.alignItems = "center";
//     marker.style.justifyContent = "center";
//
//     const icon = document.createElement("span");
//     icon.textContent = markerIconMap[color] || '●';
//     icon.style.cssText = "font-size: 14px; line-height: 1; pointer-events: none;";
//     marker.appendChild(icon);
//
//     document.body.appendChild(marker);
//     // Remove marker after 3 seconds
//     setTimeout(() => {
//         marker.style.transition = "opacity 0.5s ease";
//         marker.style.opacity = "0";
//         setTimeout(() => marker.remove(), 500);
//     }, 3000);
// }
//
// function sendMarker(xPercent, yPercent, color, message, absX, absY) {
//     ws.send(JSON.stringify({
//         type: "viewerMessage",
//         code: currentCode,
//         message: message || `${color.toUpperCase()} marker at ${xPercent.toFixed(1)}%, ${yPercent.toFixed(1)}%`,
//         markerData: { xPercent, yPercent, color }
//     }));
//     showLocalMarker(absX, absY, color);
// }
//
// function showBluePopup() {
//     const popup = document.getElementById("bluePopup");
//     const input = document.getElementById("bluePopupInput");
//     const charCount = document.getElementById("bluePopupCharCount");
//     const sendBtn = document.getElementById("bluePopupSend");
//
//     input.value = "";
//     charCount.textContent = "0 / 50";
//     sendBtn.disabled = false;
//     popup.style.display = "flex";
//     input.focus();
//
//     input.oninput = () => {
//         charCount.textContent = `${input.value.length} / 50`;
//     };
//
//     document.getElementById("bluePopupCancel").onclick = () => {
//         popup.style.display = "none";
//         pendingBlueMarker = null;
//     };
//
//     document.getElementById("bluePopupSend").onclick = submitBlueMarker;
//
//     input.onkeydown = (e) => {
//         if (e.key === "Enter") submitBlueMarker();
//         if (e.key === "Escape") {
//             popup.style.display = "none";
//             pendingBlueMarker = null;
//         }
//     };
// }
//
// function submitBlueMarker() {
//     const input = document.getElementById("bluePopupInput");
//     const text = input.value.trim();
//     if (!text || !pendingBlueMarker) return;
//
//     document.getElementById("bluePopup").style.display = "none";
//     const { xPercent, yPercent, absX, absY } = pendingBlueMarker;
//     pendingBlueMarker = null;
//     sendMarker(xPercent, yPercent, 'blue', text, absX, absY);
// }
//
// //
// // // Show temporary visual marker on viewer's side with color
// // function showLocalMarker(x, y, color) {
// //     const marker = document.createElement("div");
// //     marker.className = "local-marker";
// //     marker.style.position = "fixed";
// //     marker.style.left = `${x}px`;
// //     marker.style.top = `${y}px`;
// //     marker.style.backgroundColor = colorMap[color];
// //
// //     document.body.appendChild(marker);
// //
// //     // Remove marker after 3 seconds
// //     setTimeout(() => {
// //         marker.style.transition = "opacity 0.5s ease";
// //         marker.style.opacity = "0";
// //         setTimeout(() => marker.remove(), 500);
// //     }, 3000);
// // }

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
        el.style.opacity   = active ? '1' : '0.5';
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