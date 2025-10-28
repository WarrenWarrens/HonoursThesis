// server.mjs
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let broadcaster = null;

wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const role = url.searchParams.get("role");

    if (role === "broadcaster") {
        broadcaster = ws;
        console.log("🎥 Broadcaster connected");
    } else if (role === "viewer") {
        console.log("👀 Viewer connected");
        if (broadcaster) broadcaster.send(JSON.stringify({ type: "viewer-joined" }));
    }

    ws.on("message", (msg) => {
        if (role === "broadcaster") {
            for (const client of wss.clients) {
                if (client !== ws && client.readyState === 1) {
                    client.send(msg);
                }
            }
        }
    });

    ws.on("close", () => {
        if (role === "broadcaster") {
            console.log("🛑 Broadcaster disconnected");
            broadcaster = null;
        } else {
            console.log("👋 Viewer disconnected");
        }
    });
});

app.use(express.static(path.join(__dirname, "Viewer")));

server.listen(8080, () =>
    console.log("✅ Server running → http://localhost:8080")
);
