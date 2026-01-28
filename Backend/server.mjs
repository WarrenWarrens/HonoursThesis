// server.mjs - FIXED VERSION
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

wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const role = url.searchParams.get("role");
    const code = url.searchParams.get("code");

    if (role === "broadcaster") {
        const roomCode = generateRoomCode();
        broadcasters.set(roomCode, { ws, viewers: new Map() });

        ws.roomCode = roomCode;

        console.log(`Broadcaster started stream with code ${roomCode}`);

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

        // IMPORTANT: Handle messages from broadcaster to viewers
        ws.on("message", (message) => {
            const msg = JSON.parse(message);
            console.log("server: received message from broadcaster:", msg.type, msg);



    if (role === "viewer" && code) {
        const room = broadcasters.get(code.toUpperCase());
        if (!room) {
            ws.send(JSON.stringify({ type: "error", message: "Invalid or expired code." }));
            ws.close();
            return;
        }

        const id = randomUUID();
        room.viewers.set(id, ws);
        console.log(`Viewer joined room ${code} (${id}) -- stored in room.viewers`);

        console.log(`Room ${code} viewer count: ${room.viewers.size}`);

        room.ws.send(JSON.stringify({ type: "viewer-joined", id }));

        ws.on("message", (message) => {
            const msg = JSON.parse(message);
            console.log(`server: received message from viewer ${id} in ${code}:`, msg.type);
            console.log(`server: full message data:`, JSON.stringify(msg, null, 2));

            if (msg.type === "viewerMessage" || msg.type === "viewer_notify") {
                console.log(`server: forwarding viewer message to broadcaster for room ${code}`);

                if (room.ws && room.ws.readyState === 1) {
                    // Add the viewer ID to the message and forward EVERYTHING
                    const messageToSend = {
                        ...msg,  // Spread all properties from original message
                        id       // Add viewer ID
                    };

                    console.log(`server: sending to broadcaster:`, JSON.stringify(messageToSend, null, 2));
                    room.ws.send(JSON.stringify(messageToSend));
                } else {
                    console.warn(`server: broadcaster for room ${code} not connected`);
                }
                return;
            }

            if (room.ws && room.ws.readyState === 1) {
                room.ws.send(JSON.stringify({ ...msg, id }));
                console.log(`server: relayed viewer ${id} -> broadcaster: ${msg.type}`);
            } else {
                console.warn(`server: cannot relay viewer ${id} -> broadcaster: broadcaster not ready`);
            }
        });

    }


    ws.on("message", (message) => {
        const msg = JSON.parse(message);
        console.log("server: received message from broadcaster:", msg.type, msg);

        if (role === "broadcaster" && msg.id && msg.type !== "room-code") {
            const room = broadcasters.get(ws.roomCode);
            const target = room?.viewers.get(msg.id);

            if (target && target.readyState === 1) {
                target.send(JSON.stringify(msg));
                console.log(`server: forwarded ${msg.type} to viewer ${msg.id} in room ${ws.roomCode}`);
            } else {
                console.warn(`server: target viewer ${msg.id} not found/ready in room ${ws.roomCode}`);
            }
        });
    }
});

app.use(express.static(path.join(__dirname, "Viewer")));

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running → http://localhost:${PORT}`);
});
