document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("start");
    const stopBtn = document.getElementById("stop");
    const videoEl = document.getElementById("preview");
    let stream, ws;
    const pcs = new Map();

    const overlay = document.getElementById("overlay-container");
    const overlayHeader = document.getElementById("overlay-header");
    let offsetX = 0, offsetY = 0, isDragging = false;

    if (overlayHeader && overlay) {
        overlayHeader.addEventListener("mousedown", (e) => {
            isDragging = true;
            offsetX = e.clientX - overlay.offsetLeft;
            offsetY = e.clientY - overlay.offsetTop;
            overlay.style.cursor = "grabbing";
        });

        document.addEventListener("mouseup", () => {
            isDragging = false;
            if (overlay) overlay.style.cursor = "grab";
        });

        document.addEventListener("mousemove", (e) => {
            if (!isDragging || !overlay) return;
            overlay.style.left = (e.clientX - offsetX) + "px";
            overlay.style.top = (e.clientY - offsetY) + "px";
        });
    }

    startBtn.addEventListener("click", async () => {
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            videoEl.srcObject = stream;
            startBtn.disabled = true;
            stopBtn.disabled = false;
            ws = new WebSocket(
                "wss://honoursthesisstreambackend.onrender.com?role=broadcaster"
            );


            ws.addEventListener("open", () => {
                console.log("Broadcaster connected (WS open)");
            });

            ws.addEventListener("message", async (event) => {
                const msg = JSON.parse(event.data);
                console.log("broadcaster ws message:", msg.type, msg);

                if (msg.type === "room-code") {
                    alert(`Your stream code is: ${msg.code}`);
                } else if (msg.type === "viewer-joined") {
                    await createOffer(msg.id);
                } else if (msg.type === "answer") {
                    const pc = pcs.get(msg.id);
                    if (pc) {
                        console.log("broadcaster: got answer for", msg.id);
                        await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
                    }
                } else if (msg.type === "candidate") {
                    const pc = pcs.get(msg.id);
                    if (pc) {
                        console.log("broadcaster: adding remote candidate for", msg.id);
                        await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                    } else {
                        console.warn("broadcaster: candidate for unknown pc id", msg.id);
                    }
                } else if (msg.type === "viewer-left") {
                    const pc = pcs.get(msg.id);
                    if (pc) {
                        pc.close();
                        pcs.delete(msg.id);
                    }
                } else if (msg.type === "viewerMessage") {
                    console.log("Viewer message received:", msg);

                    // Check if this is a positioned notification
                    if (msg.position) {
                        showPositionedNotification(msg.tool, msg.position, msg.message);
                    } else {
                        // Regular message notification
                        showMessageOverlay(msg.message);
                    }
                }
            });

            stream.getVideoTracks()[0].onended = stopCapture;
        } catch (err) {
            console.error("Capture failed:", err);
            alert("Failed to start screen capture: " + err.message);
        }
    });

    async function createOffer(viewerId) {
        const ICE_CONFIG = { iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] };

        const pc = new RTCPeerConnection(ICE_CONFIG);
        pcs.set(viewerId, pc);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("broadcaster: sending candidate for", viewerId, event.candidate);
                ws.send(JSON.stringify({ type: "candidate", id: viewerId, candidate: event.candidate }));
            }
        };

        pc.oniceconnectionstatechange = () => console.log(`broadcaster pc[${viewerId}] iceConnectionState:`, pc.iceConnectionState);
        pc.onconnectionstatechange = () => console.log(`broadcaster pc[${viewerId}] connectionState:`, pc.connectionState);

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            console.log("broadcaster: created offer for", viewerId);
            // send the offer and log
            ws.send(JSON.stringify({ type: "offer", id: viewerId, offer }));
            console.log("broadcaster: sent offer to server for viewer", viewerId);
        } catch (err) {
            console.error("broadcaster: error creating/sending offer:", err);
        }
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
        if (!box || !content) return;

        content.textContent = text;
        box.style.display = "block";
        box.style.width = "auto";
        box.style.height = "auto";

        if (hideTimeout) clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            box.style.display = "none";
        }, 5000);
    }

    // NEW FUNCTION: Show positioned notification on screen
    function showPositionedNotification(tool, position, message) {
        console.log(`Showing positioned notification: ${tool} at (${position.xPercent}%, ${position.yPercent}%)`);

        // Create a notification marker on the screen
        const marker = document.createElement('div');
        marker.className = 'positioned-marker';
        marker.style.left = `${position.xPercent}%`;
        marker.style.top = `${position.yPercent}%`;

        // Different colors for different tools
        const colors = {
            'tool1': '#4CAF50',
            'tool2': '#2196F3',
            'tool3': '#FF9800'
        };

        const toolNames = {
            'tool1': 'Tool 1',
            'tool2': 'Tool 2',
            'tool3': 'Tool 3'
        };

        marker.style.borderColor = colors[tool] || '#fff';
        marker.style.backgroundColor = colors[tool] || '#fff';

        // Add label
        const label = document.createElement('div');
        label.className = 'marker-label';
        label.textContent = toolNames[tool] || tool;
        label.style.backgroundColor = colors[tool] || '#fff';
        marker.appendChild(label);

        // Add to body (full screen positioning)
        document.body.appendChild(marker);

        // Animate in
        setTimeout(() => marker.classList.add('show'), 10);

        // Remove after animation
        setTimeout(() => {
            marker.classList.remove('show');
            setTimeout(() => marker.remove(), 500);
        }, 3000);

        // Also show a brief notification
        showNotificationPopup(`${toolNames[tool]} placed at (${Math.round(position.xPercent)}%, ${Math.round(position.yPercent)}%)`);
    }
});