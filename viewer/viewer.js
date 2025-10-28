const ws = new WebSocket(`ws://${location.host}?role=viewer`);
let pc;

ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === "offer") {
        pc = new RTCPeerConnection();
        pc.ontrack = (event) => {
            document.getElementById("remoteVideo").srcObject = event.streams[0];
        };

        await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        ws.send(JSON.stringify({ type: "answer", answer }));
    } else if (msg.type === "candidate" && pc) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch (err) {
            console.error("Error adding ICE candidate:", err);
        }
    }
};
