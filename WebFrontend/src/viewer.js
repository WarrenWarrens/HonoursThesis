const joinForm = document.getElementById("joinForm");
const joinBtn = document.getElementById("joinBtn");
const codeInput = document.getElementById("codeInput");
const errorEl = document.getElementById("error");
const videoEl = document.getElementById("remoteVideo");
let ws, pc;

joinBtn.onclick = () => {
    const code = codeInput.value.trim().toUpperCase();
    if (code.length !== 4) {
        errorEl.textContent = "Enter a valid 4-letter code.";
        return;
    }
    startViewer(code);
};

function startViewer(code) {
    joinForm.style.display = "none";
    videoEl.style.display = "block";
    ws = new WebSocket(`wss://honoursthesisstreambackend.onrender.com?role=viewer&code=${code}`);

    ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "error") {
            errorEl.textContent = msg.message;
            joinForm.style.display = "flex";
            videoEl.style.display = "none";
            return;
        }

        if (msg.type === "offer") {
            pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

            pc.ontrack = (event) => {
                videoEl.srcObject = event.streams[0];
            };

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
                }
            };

            await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            ws.send(JSON.stringify({ type: "answer", answer }));
        } else if (msg.type === "candidate" && pc) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } else if (msg.type === "broadcaster-disconnected") {
            alert("Broadcaster ended the stream.");
            videoEl.srcObject = null;
        }
    };
}

const notifyBtn = document.getElementById("notifyBtn");

notifyBtn.addEventListener("click", () => {
    ws.send(JSON.stringify({ type: "viewer_notify" }));
    alert("Notification sent to streamer!");
});
