document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("start");
    const stopBtn = document.getElementById("stop");
    const videoEl = document.getElementById("preview");
    let stream, ws;
    const pcs = new Map();

    const overlay = document.getElementById("overlay-container");
    const overlayHeader = document.getElementById("overlay-header");
    let offsetX = 0, offsetY = 0, isDragging = false;

    // Make overlay draggable
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

                    // Check if message contains marker data
                    if (msg.markerData) {
                        showMarkerOnVideo(msg.markerData.xPercent, msg.markerData.yPercent, msg.message);
                    } else {
                        // Regular text message
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

    // New function to display markers on the video at the same location viewer clicked
    function showMarkerOnVideo(xPercent, yPercent, message) {
        // Create marker element
        const marker = document.createElement("div");
        marker.style.position = "absolute";
        marker.style.width = "30px";
        marker.style.height = "30px";
        marker.style.backgroundColor = "rgba(255, 0, 0, 0.8)";
        marker.style.borderRadius = "50%";
        marker.style.border = "3px solid white";
        marker.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
        marker.style.zIndex = "9998";
        marker.style.pointerEvents = "none";

        // Calculate position based on video preview dimensions
        const videoRect = videoEl.getBoundingClientRect();
        const markerX = (xPercent / 100) * videoRect.width;
        const markerY = (yPercent / 100) * videoRect.height;

        marker.style.left = `${markerX}px`;
        marker.style.top = `${markerY}px`;
        marker.style.transform = "translate(-50%, -50%)";

        // Add to body positioned relative to video
        document.body.appendChild(marker);

        // Adjust position to be relative to video element on page
        const absoluteX = videoRect.left + markerX;
        const absoluteY = videoRect.top + markerY;
        marker.style.left = `${absoluteX}px`;
        marker.style.top = `${absoluteY}px`;
        marker.style.position = "fixed"; // Use fixed positioning

        // Also show the message in overlay
        showMessageOverlay(message);

        // Add pulsing animation
        marker.style.animation = "pulse 0.5s ease-in-out";

        // Remove marker after 5 seconds
        setTimeout(() => {
            marker.style.transition = "opacity 0.5s";
            marker.style.opacity = "0";
            setTimeout(() => marker.remove(), 500);
        }, 5000);
    }

    // Add CSS animation for marker pulse
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, -50%) scale(1.3); }
        }
    `;
    document.head.appendChild(style);
});