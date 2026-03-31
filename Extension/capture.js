document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("start");
    const stopBtn = document.getElementById("stop");
    const videoEl = document.getElementById("preview");
    let stream, ws;
    const pcs = new Map();

    const overlay = document.getElementById("overlay-container");
    const overlayHeader = document.getElementById("overlay-header");
    let offsetX = 0, offsetY = 0, isDragging = false;
    const logData = []; // structured entries for CSV export
    // CHANGED: green → yellow with correct hex
    const viewerMarkerCount = new Map(); // tracks how many active markers each viewer has
    const colorMap = {
        red:    '#ff0000',
        blue:   '#0066ff',
        yellow: '#ffdd00',
        green:  '#00cc44'
    };

    const BANNED_WORDS = ['shit', 'fuck', 'ass', 'bitch', 'cunt', 'damn', 'piss', 'cock', 'dick'];

    function censorMessage(text) {
        if (!text) return text;
        let censored = text;
        BANNED_WORDS.forEach(word => {
            const regex = new RegExp(word, 'gi');
            censored = censored.replace(regex, '#'.repeat(word.length));
        });
        return censored;
    }

    const markerIconMap = {
        red:    '🐛',
        blue:   '💬',
        yellow: '❓',
        green:  '✓'
    };

    const markerDuration = {
        red:    10000,
        blue:   7000,
        yellow: 5000,
        green:  5000
    };


    // NEW: track active markers to enforce the 7-marker limit
    const activeMarkers = [];
    const MAX_MARKERS = 7;

    // Map viewer id → assigned name
    const viewerNames = new Map();

    function addLogEntry(text, type) {
        // const entriesEl = document.getElementById("activity-log-entries");
        // if (!entriesEl) return;
        //
        // const now = new Date();
        // const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        //
        // const entry = document.createElement("div");
        // entry.className = "log-entry";
        // entry.innerHTML = `<span class="log-time">[${time}]</span><span class="log-${type}">${text}</span>`;
        //
        // entriesEl.appendChild(entry);
        // // Keep scrolled to bottom
        // entriesEl.scrollTop = entriesEl.scrollHeight;
        // logData.push({ time, type, text });

        const entriesEl = document.getElementById("activity-log-entries");
        if (!entriesEl) return;

        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const entry = document.createElement("div");
        entry.className = "log-entry";
        entry.innerHTML = `<span class="log-time">[${time}]</span><span class="log-${type}">${text}</span>`;
        entriesEl.appendChild(entry);
        entriesEl.scrollTop = entriesEl.scrollHeight;

        // Store structured data for export
        logData.push({ time, type, text });

    }

    function addViewer(name) {
        const entriesEl = document.getElementById("viewer-list-entries");
        if (!entriesEl) return;

        const entry = document.createElement("div");
        entry.className = "viewer-entry";
        entry.id = `viewer-entry-${name.replace(/\s/g, '-')}`;
        entry.textContent = `● ${name}`;
        entriesEl.appendChild(entry);

        updateViewerCount();
    }

    function removeViewer(name) {
        const entry = document.getElementById(`viewer-entry-${name.replace(/\s/g, '-')}`);
        if (entry) entry.remove();
        updateViewerCount();
    }

    function updateViewerCount() {
        const countEl = document.getElementById("viewer-count");
        const entriesEl = document.getElementById("viewer-list-entries");
        if (countEl && entriesEl) {
            countEl.textContent = entriesEl.children.length;
        }
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

                }// AFTER
                else if (msg.type === "viewer-joined") {
                    const name = msg.viewerName || `Viewer-${msg.id.slice(0, 4)}`;
                    viewerNames.set(msg.id, name);
                    addLogEntry(`${name} joined`, "join");
                    addViewer(name);                    // ← add this

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
                }

                 else if (msg.type === "viewer-left")
                 {
                    const name = viewerNames.get(msg.id) || msg.viewerName || `Viewer-${msg.id.slice(0, 4)}`;
                    viewerNames.delete(msg.id);
                    addLogEntry(`${name} left`, "leave");
                    removeViewer(name);                 // ← add this

                     const pc = pcs.get(msg.id);
                    if (pc) { pc.close(); pcs.delete(msg.id); }

                }
                 else if (msg.type === "viewerMessage" && msg.markerData)
                {
                    const name = viewerNames.get(msg.id) || msg.viewerName || `Viewer-${msg.id.slice(0, 4)}`;
                    const { xPercent, yPercent, color } = msg.markerData;
                    const markerMsg = msg.message || '';

                    showMarkerOnVideo(xPercent, yPercent, markerMsg, color, name);  // ← add name


                    const pos = `(${xPercent.toFixed(1)}%, ${yPercent.toFixed(1)}%)`;
                    const detail = color === 'blue' && markerMsg ? `: "${markerMsg}"` : '';
                    addLogEntry(`${name}: ${color} marker @ ${pos}${detail}`, "marker");

                    browser.runtime.sendMessage({
                        type: "FORWARD_MARKER_TO_TAB",
                        data: msg.markerData,
                        message: markerMsg
                    });
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
        downloadLog('csv');
        ws?.close();
    }

    document.getElementById("clearMarkersBtn").addEventListener("click", () => {
        [...activeMarkers].forEach(wrapper => {
            wrapper.style.transition = "opacity 0.3s";
            wrapper.style.opacity = "0";
            setTimeout(() => wrapper.remove(), 300);
        });
        activeMarkers.length = 0;

        // remove all viewer highlights
        viewerMarkerCount.clear();
        document.querySelectorAll(".viewer-entry.marker-active")
            .forEach(el => el.classList.remove("marker-active"));
    });


    stopBtn.addEventListener("click", stopCapture);

    function downloadLog(format) {
        if (logData.length === 0) return;

        const timestamp = new Date().toISOString().slice(0,19).replace(/[:T]/g, "-");
        let content, mime, ext;

        if (format === 'csv') {
            const headers = ["Time", "Type", "Details"];
            const rows = logData.map(e => [
                `"${e.time}"`,
                `"${e.type}"`,
                `"${e.text.replace(/"/g, '""')}"`
            ]);
            content = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
            mime = "text/csv";
            ext = "csv";
        } else {
            content = logData.map(e => `[${e.time}] (${e.type}) ${e.text}`).join("\n");
            mime = "text/plain";
            ext = "txt";
        }

        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([content], { type: mime }));
        a.download = `stream-log-${timestamp}.${ext}`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    document.getElementById("downloadCsvBtn").addEventListener("click", () => downloadLog('csv'));
    document.getElementById("downloadTxtBtn").addEventListener("click", () => downloadLog('txt'));

    // document.getElementById("downloadLogBtn").addEventListener("click", () => {
    //     if (logData.length === 0) return;
    //
    //     const headers = ["Time", "Type", "Details"];
    //     const rows = logData.map(e => [
    //         `"${e.time}"`,
    //         `"${e.type}"`,
    //         `"${e.text.replace(/"/g, '""')}"` // escape any quotes in the text
    //     ]);
    //
    //     const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    //     const blob = new Blob([csv], { type: "text/csv" });
    //     const url = URL.createObjectURL(blob);
    //
    //     const a = document.createElement("a");
    //     a.href = url;
    //     a.download = `stream-log-${new Date().toISOString().slice(0,19).replace(/[:T]/g, "-")}.csv`;
    //     a.click();
    //     URL.revokeObjectURL(url);
    // });

    let hideTimeout;
    function showMessageOverlay(text) {
        const box = document.getElementById("overlay-container");
        const content = document.getElementById("overlay-content");
        if (!box || !content) return;

        content.textContent = censorMessage(text);
        box.style.display = "block";
        box.style.width = "auto";
        box.style.height = "auto";

        if (hideTimeout) clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            box.style.display = "none";
        }, 5000);
    }

    function showMarkerOnVideo(xPercent, yPercent, message, color) {
        const markerColor = colorMap[color] || '#ff0000';
        const duration = markerDuration[color] || 5000;

        if (activeMarkers.length >= MAX_MARKERS) {
            const oldest = activeMarkers.shift();
            oldest.remove();
        }

        const videoRect = videoEl.getBoundingClientRect();
        const markerX = videoRect.left + (xPercent / 100) * videoRect.width;
        const markerY = videoRect.top  + (yPercent / 100) * videoRect.height;

        // Wrapper — holds both the dot and the close button, intercepts pointer events
        const wrapper = document.createElement("div");
        wrapper.style.cssText = `
        position: fixed;
        left: ${markerX}px;
        top: ${markerY}px;
        width: 0;
        height: 0;
        z-index: 9998;
        pointer-events: none;
    `;

        // Marker dot
        const marker = document.createElement("div");
        marker.style.cssText = `
        position: absolute;
        width: 30px;
        height: 30px;
        background-color: ${markerColor};
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 0 15px ${markerColor};
        transform: translate(-50%, -50%);
        animation: pulse 0.5s ease-in-out;
        pointer-events: auto;
        cursor: default;
    `;
        wrapper.appendChild(marker);

        // Close button — appears below the dot on hover
        const closeBtn = document.createElement("div");
        closeBtn.textContent = "✕";
        closeBtn.style.cssText = `
        position: absolute;
        top: 14px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.75);
        color: white;
        font-size: 11px;
        line-height: 1;
        padding: 3px 5px;
        border-radius: 4px;
        cursor: pointer;
        pointer-events: auto;
        opacity: 0;
        transition: opacity 0.15s;
        user-select: none;
        white-space: nowrap;
    `;
        wrapper.appendChild(closeBtn);

        // Show / hide close button on hover
        marker.addEventListener("mouseenter", () => { closeBtn.style.opacity = "1"; });
        marker.addEventListener("mouseleave", (e) => {
            // Keep it visible if pointer moves to the button itself
            if (e.relatedTarget !== closeBtn) closeBtn.style.opacity = "0";
        });
        closeBtn.addEventListener("mouseleave", (e) => {
            if (e.relatedTarget !== marker) closeBtn.style.opacity = "0";
        });
        closeBtn.addEventListener("mouseenter", () => { closeBtn.style.opacity = "1"; });

        function dismiss() {
            wrapper.style.transition = "opacity 0.3s";
            wrapper.style.opacity = "0";
            setTimeout(() => {
                wrapper.remove();
                const idx = activeMarkers.indexOf(wrapper);
                if (idx > -1) activeMarkers.splice(idx, 1);
                if (viewerName) {
                    const remaining = (viewerMarkerCount.get(viewerName) || 1) - 1;
                    viewerMarkerCount.set(viewerName, remaining);
                    if (remaining <= 0) {
                        const entryEl = document.getElementById(`viewer-entry-${viewerName.replace(/\s/g, '-')}`);
                        if (entryEl) entryEl.classList.remove("marker-active");
                        viewerMarkerCount.delete(viewerName);
                    }
                }
            }, 300);


        }

        closeBtn.addEventListener("click", dismiss);

        document.body.appendChild(wrapper);



        showMessageOverlay(message);
        activeMarkers.push(wrapper);

        // Auto-remove after colour-specific duration
        let autoRemoved = false;
        setTimeout(() => {
            if (!autoRemoved && wrapper.isConnected) {
                autoRemoved = true;
                dismiss();
            }
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