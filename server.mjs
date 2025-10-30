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

const broadcasters = new Map(); //Map<roomCode, { ws, viewers: Map<viewerId, ws> }>

function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; //exclude 0/O/I/l
    let code = "";
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const role = url.searchParams.get("role");
    const code = url.searchParams.get("code");

    if (role === "broadcaster") {
        const roomCode = generateRoomCode();
        broadcasters.set(roomCode, { ws, viewers: new Map() });
        ws.roomCode = roomCode;
        console.log(`Broadcaster started stream with code ${roomCode}`);

        //sends room code back to streamer
        ws.send(JSON.stringify({ type: "room-code", code: roomCode }));

        ws.on("close", () => {
            console.log(`Broadcaster with code ${roomCode} disconnected`);
            const entry = broadcasters.get(roomCode);
            if (entry) {
                for (const [, viewerWs] of entry.viewers) {
                    if (viewerWs.readyState === 1) {
                        viewerWs.send(JSON.stringify({ type: "broadcaster-disconnected" }));
                    }
                }
                broadcasters.delete(roomCode);
            }
        });
    }

    else if (role === "viewer" && code) {
        const room = broadcasters.get(code.toUpperCase());
        if (!room) {
            ws.send(JSON.stringify({ type: "error", message: "Invalid or expired code." }));
            ws.close();
            return;
        }

        const id = randomUUID();
        room.viewers.set(id, ws);
        console.log(`Viewer joined room ${code} (${id})`);

        //notifies streamer that a viewer has joined
        room.ws.send(JSON.stringify({ type: "viewer-joined", id }));

        ws.on("message", (message) => {
            const msg = JSON.parse(message);
            room.ws.send(JSON.stringify({ ...msg, id }));
        });

        ws.on("close", () => {
            console.log(`Viewer left room ${code} (${id})`);
            room.viewers.delete(id);
            if (room.ws.readyState === 1) {
                room.ws.send(JSON.stringify({ type: "viewer-left", id }));
            }
        });
    }

    //streamer to viewer
    ws.on("message", (message) => {
        const msg = JSON.parse(message);
        if (role === "broadcaster" && msg.id && msg.type !== "room-code") {
            const room = broadcasters.get(ws.roomCode);
            const target = room?.viewers.get(msg.id);
            if (target && target.readyState === 1) target.send(JSON.stringify(msg));
        }
    });
});

app.use(express.static(path.join(__dirname, "Viewer")));

server.listen(8080, () => {
    console.log("Server running → http://localhost:8080");
});
