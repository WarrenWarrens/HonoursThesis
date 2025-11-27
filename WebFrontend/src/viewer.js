const joinForm = document.getElementById("joinForm");
const joinBtn = document.getElementById("joinBtn");
const codeInput = document.getElementById("codeInput");
const errorEl = document.getElementById("error");
const videoEl = document.getElementById("remoteVideo");
const notifyBtn = document.getElementById("notifyBtn");
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

    // connect to backend server
    ws = new WebSocket(`wss://honoursthesisstreambackend.onrender.com?role=viewer&code=${code}`);

    ws.onopen = () => {
        console.log("Viewer connected");
        // ✅ send join message using the correct variable
        ws.send(JSON.stringify({ type: "join", role: "viewer", code }));
    };

    // ✅ viewer’s notify button
    notifyBtn.addEventListener("click", () => {
        if (ws?.readyState === WebSocket.OPEN) {
            console.log("Viewer pressed button!");
            ws.send(JSON.stringify({
                type: "viewer_notify",
                code,
                message: "Viewer pressed the button!"
            }));
            alert("Notification sent to the streamer!");
        } else {
            alert("Connection not ready yet!");
        }
    });

    ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "error") {
            errorEl.textContent = msg.message;
            joinForm.style.display = "flex";
            videoEl.style.display = "none";
            return;
        }

        if (msg.type === "offer") {
            const ICE_SERVERS = {
                iceServers: [{
                    urls: [ "stun:us-turn3.xirsys.com" ]
                }, {
                    username: "nKr-LEorDuJH2cS1BS-YwjffBRrWL4i2iHIhdlCh1H1fzWqFxfb0Wo_S4_Ne34HdAAAAAGkWF8ZSV2FycmVu",
                    credential: "ae75724a-c0b7-11f0-a466-0242ac140004",
                    urls: [
                        "turn:us-turn3.xirsys.com:80?transport=udp",
                        "turn:us-turn3.xirsys.com:3478?transport=udp",
                        "turn:us-turn3.xirsys.com:80?transport=tcp",
                        "turn:us-turn3.xirsys.com:3478?transport=tcp",
                        "turns:us-turn3.xirsys.com:443?transport=tcp",
                        "turns:us-turn3.xirsys.com:5349?transport=tcp"
                    ]
                }]


            };

            pc = new RTCPeerConnection(ICE_SERVERS);

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

        }
        else if (msg.type === "candidate" && pc) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        }
        else if (msg.type === "broadcaster-disconnected") {
            alert("Broadcaster ended the stream.");
            videoEl.srcObject =null;
        }
    };
}
