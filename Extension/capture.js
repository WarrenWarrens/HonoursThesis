document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("start");
    const stopBtn = document.getElementById("stop");
    const videoEl = document.getElementById("preview");
    let stream, ws;
    const pcs = new Map();

    const overlay = document.getElementById("overlay-container");
    const overlayHeader = document.getElementById("overlay-header");
    let offsetX = 0, offsetY = 0, isDragging = false;

    // CHANGED: green → yellow with correct hex
    const colorMap = {
        red: '#ff0000',
        blue: '#0066ff',
        yellow: '#ffdd00'
    };
    const markerIconMap = { red: '🐛', yellow: '❓', blue: '💬' };

    // NEW: per-colour display durations in milliseconds
    const markerDuration = {
        red: 10000,
        blue: 7000,
        yellow: 5000
    };

    // NEW: track active markers to enforce the 7-marker limit
    const activeMarkers = [];
    const MAX_MARKERS = 7;

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
                    // CHANGED: replaced alert() with an on-screen banner + copy button
                    const banner = document.createElement("div");
                    banner.style.cssText = `
                        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                        background: #222; color: white; padding: 14px 24px; border-radius: 10px;
                        font-size: 18px; z-index: 99999; box-shadow: 0 4px 15px rgba(0,0,0,0.4);
                        display: flex; align-items: center; gap: 14px; font-family: sans-serif;
                    `;
                    banner.innerHTML = `
                        <span>Stream Code: <strong style="font-size:22px; letter-spacing:3px;">${msg.code}</strong></span>
                        <button id="copyCodeBtn" style="
                            padding: 6px 14px; background: #0078ff; color: white;
                            border: none; border-radius: 6px; cursor: pointer; font-size: 14px;
                        ">Copy</button>
                    `;
                    document.body.appendChild(banner);

                    document.getElementById("copyCodeBtn").addEventListener("click", () => {
                        navigator.clipboard.writeText(msg.code).then(() => {
                            document.getElementById("copyCodeBtn").textContent = "Copied!";
                            setTimeout(() => {
                                document.getElementById("copyCodeBtn").textContent = "Copy";
                            }, 2000);
                        });
                    });

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

                    if (msg.markerData) {
                        const color = msg.markerData.color || 'red';

                        // Show on the preview video (stream tab)
                        showMarkerOnVideo(
                            msg.markerData.xPercent,
                            msg.markerData.yPercent,
                            msg.message,
                            color
                        );

                        // Forward to whichever tab the host is actively viewing
                        browser.runtime.sendMessage({
                            type: "FORWARD_MARKER_TO_TAB",
                            data: msg.markerData,
                            message: msg.message
                        });

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
        const ICE_CONFIG = {
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                {
                    urls: "turn:openrelay.metered.ca:80",
                    username: "openrelayproject",
                    credential: "openrelayproject"
                },
                {
                    urls: "turn:openrelay.metered.ca:443",
                    username: "openrelayproject",
                    credential: "openrelayproject"
                },
                {
                    urls: "turn:openrelay.metered.ca:443?transport=tcp",
                    username: "openrelayproject",
                    credential: "openrelayproject"
                }
            ]
        };
        // const ICE_CONFIG = { iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] };

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

    // UPDATED: uses per-colour duration and enforces 7-marker limit
    function showMarkerOnVideo(xPercent, yPercent, message, color) {
        const markerColor = colorMap[color] || '#ff0000';
        const duration = markerDuration[color] || 5000;

        // Enforce marker limit — remove oldest if at cap
        if (activeMarkers.length >= MAX_MARKERS) {
            const oldest = activeMarkers.shift();
            oldest.remove();
        }

        // Create marker element
        const marker = document.createElement("div");
        // After creating the marker div and setting its styles, add this before appendChild:
        marker.style.display = "flex";
        marker.style.alignItems = "center";
        marker.style.justifyContent = "center";

        const icon = document.createElement("span");
        icon.textContent = markerIconMap[color] || '●';
        icon.style.cssText = "font-size: 14px; line-height: 1; pointer-events: none;";
        marker.appendChild(icon);

        marker.style.position = "absolute";
        marker.style.width = "30px";
        marker.style.height = "30px";
        marker.style.backgroundColor = markerColor;
        marker.style.borderRadius = "50%";
        marker.style.border = "3px solid white";
        marker.style.boxShadow = `0 0 15px ${markerColor}`;
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
        marker.style.position = "fixed";

        // Show message in overlay
        showMessageOverlay(message);

        // Add pulsing animation
        marker.style.animation = "pulse 0.5s ease-in-out";

        // Track this marker
        activeMarkers.push(marker);

        // Remove after colour-specific duration
        setTimeout(() => {
            marker.style.transition = "opacity 0.5s";
            marker.style.opacity = "0";
            setTimeout(() => {
                marker.remove();
                const idx = activeMarkers.indexOf(marker);
                if (idx > -1) activeMarkers.splice(idx, 1);
            }, 500);
        }, duration);
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