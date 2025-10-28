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

let broadcaster = null;
const viewers = new Map(); // Map<viewerId, ws>

wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const role = url.searchParams.get("role");

    if (role === "broadcaster") {
        broadcaster = ws;
        console.log("🎥 Broadcaster connected");
    } else if (role === "viewer") {
        const id = randomUUID();
        viewers.set(id, ws);
        console.log(`👀 Viewer connected: ${id}`);

        // Notify broadcaster that a new viewer joined
        if (broadcaster && broadcaster.readyState === 1) {
            broadcaster.send(JSON.stringify({ type: "viewer-joined", id }));
        }

        ws.on("close", () => {
            viewers.delete(id);
            console.log(`👋 Viewer disconnected: ${id}`);
            if (broadcaster && broadcaster.readyState === 1) {
                broadcaster.send(JSON.stringify({ type: "viewer-left", id }));
            }
        });
    }

    ws.on("message", (message) => {
        let msg;
        try {
            msg = JSON.parse(message);
        } catch {
            console.error("Invalid JSON message:", message);
            return;
        }

        // Route messages appropriately
        if (role === "broadcaster") {
            // Broadcaster → Viewer
            const target = viewers.get(msg.id);
            if (target && target.readyState === 1) {
                target.send(JSON.stringify(msg));
            }
        } else if (role === "viewer") {
            // Viewer → Broadcaster
            if (broadcaster && broadcaster.readyState === 1) {
                broadcaster.send(JSON.stringify({ ...msg, id: [...viewers].find(([key, val]) => val === ws)?.[0] }));
            }
        }
    });

    ws.on("close", () => {
        if (role === "broadcaster") {
            console.log("🛑 Broadcaster disconnected");
            broadcaster = null;
            // Inform all viewers
            for (const [, viewer] of viewers) {
                if (viewer.readyState === 1) {
                    viewer.send(JSON.stringify({ type: "broadcaster-disconnected" }));
                }
            }
        }
    });
});

app.use(express.static(path.join(__dirname, "Viewer")));

server.listen(8080, () => {
    console.log("✅ Server running → http://localhost:8080");
});
