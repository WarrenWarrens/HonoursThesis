
// server.mjs
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const broadcasters = new Map();

function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}


// Replace your existing NAME_COLORS and NAME_ANIMALS with these:
const NAME_COLORS = [
    'Red','Blue','Green','Purple','Orange','Pink','Cyan','Gold',
    'Silver','Teal','Violet','Crimson','Amber','Coral','Indigo','Jade'
];

const NAME_ADJECTIVES = [
    'Brave','Clever','Swift','Mighty','Sneaky','Gentle','Fierce',
    'Jolly','Gloomy','Fuzzy','Spooky','Grumpy','Dizzy','Witty','Calm'
];

const NAME_ANIMALS = [
    'Fox','Wolf','Bear','Eagle','Shark','Tiger','Panda','Otter',
    'Raven','Lynx','Hawk','Seal','Owl','Deer','Gecko','Viper',
    'Moose','Bison','Crane','Dingo'
];

// Replace generateViewerName():
function generateViewerName() {
    const adj    = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
    const color  = NAME_COLORS    [Math.floor(Math.random() * NAME_COLORS.length)];
    const animal = NAME_ANIMALS   [Math.floor(Math.random() * NAME_ANIMALS.length)];
    return `${adj} ${color} ${animal}`;
}


// ─────────────────────────────────────────────────────────────────────────────

wss.on("connection", (ws, req) => {
    const url  = new URL(req.url, `http://${req.headers.host}`);
    const role = url.searchParams.get("role");
    const code = url.searchParams.get("code");

    if (role === "broadcaster") {
        const roomCode = generateRoomCode();
        broadcasters.set(roomCode, { ws, viewers: new Map(), muted: new Set() });

        ws.roomCode = roomCode;

        console.log(`Broadcaster started stream with code ${roomCode}`);
        ws.send(JSON.stringify({ type: "room-code", code: roomCode }));

        ws.on("close", () => {
            console.log(`Broadcaster with code ${roomCode} disconnected`);
            const entry = broadcasters.get(roomCode);
            if (entry) {
                for (const [, viewer] of entry.viewers) {
                    if (viewer.ws.readyState === 1) {
                        viewer.ws.send(JSON.stringify({ type: "broadcaster-disconnected" }));
                    }
                }
                broadcasters.delete(roomCode);
            }
        });

        ws.on("message", (message) => {
            const msg = JSON.parse(message);
            console.log("server: received message from broadcaster:", msg.type, msg);

            if (msg.type === "mute-viewer" && msg.id) {
                const room = broadcasters.get(roomCode);
                if (!room) return;
                room.muted.add(msg.id);
                const viewer = room.viewers.get(msg.id);
                if (viewer?.ws?.readyState === 1) {
                    viewer.ws.send(JSON.stringify({ type: "muted", duration: 300000 }));
                }
                setTimeout(() => room.muted.delete(msg.id), 300000);
                return;
            }

            if (msg.id && msg.type !== "room-code") {
                const room   = broadcasters.get(roomCode);
                const viewer = room?.viewers.get(msg.id);
                const target = viewer?.ws;               // ← unwrap {ws, name}

                if (target && target.readyState === 1) {
                    target.send(JSON.stringify(msg));
                    console.log(`server: forwarded ${msg.type} to viewer ${msg.id}`);
                } else {
                    console.warn(`server: target viewer ${msg.id} not found/ready`);
                }
            }
        });
    }

    if (role === "viewer" && code) {
        const room = broadcasters.get(code.toUpperCase());
        if (!room) {
            ws.send(JSON.stringify({ type: "error", message: "Invalid or expired code." }));
            ws.close();
            return;
        }

        const id          = randomUUID();
        const viewerName  = generateViewerName();   // ← defined BEFORE it's used below
        room.viewers.set(id, { ws, name: viewerName });

        console.log(`Viewer "${viewerName}" joined room ${code} (${id})`);
        console.log(`Room ${code} viewer count: ${room.viewers.size}`);

        room.ws.send(JSON.stringify({ type: "viewer-joined", id, viewerName }));

        ws.on("message", (message) => {
            const msg = JSON.parse(message);
            console.log(`server: received message from viewer ${id} (${viewerName}):`, msg.type);

            if (msg.type === "viewerMessage" || msg.type === "viewer_notify") {
                if (room.muted.has(id)) return;

                if (room.ws && room.ws.readyState === 1) {
                    const messageToSend = {
                        ...msg,         // preserves markerData, message, etc.
                        id,
                        viewerName      // ← now safely defined
                    };
                    console.log(`server: forwarding to broadcaster:`, JSON.stringify(messageToSend, null, 2));
                    room.ws.send(JSON.stringify(messageToSend));
                } else {
                    console.warn(`server: broadcaster for room ${code} not connected`);
                }
                return;
            }

            // WebRTC signalling (answer, candidate)
            if (room.ws && room.ws.readyState === 1) {
                room.ws.send(JSON.stringify({ ...msg, id }));
            }
        });

        ws.on("close", () => {
            console.log(`Viewer "${viewerName}" (${id}) disconnected from room ${code}`);
            room.viewers.delete(id);
            if (room.ws && room.ws.readyState === 1) {
                room.ws.send(JSON.stringify({ type: "viewer-left", id, viewerName }));
            }
        });
    }
});

app.use(express.static(path.join(__dirname, "Viewer")));

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running → http://localhost:${PORT}`);
});