const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const wss = new WebSocket.Server({ port: 8080 });
let host = null;
let guests = {};

wss.on("connection", (ws) => {
    ws.id = uuidv4();

    ws.on("message", (message) => {
        const data = JSON.parse(message);

        if (data.type === "host") {
            host = ws;
            console.log("Host connected");
        } else if (data.type === "guest") {
            guests[ws.id] = ws;
            console.log("Guest connected:", ws.id);
            ws.send(JSON.stringify({ type: "guest-id", id: ws.id }));
        } else if (data.type === "signal") {
            if (data.to === "host" && host) {
                host.send(JSON.stringify({ from: ws.id, payload: data.payload }));
            } else if (data.to && guests[data.to]) {
                guests[data.to].send(JSON.stringify({ from: "host", payload: data.payload }));
            }
        }
    });

    ws.on("close", () => {
        if (ws === host) {
            console.log("Host disconnected");
            host = null;
        } else if (guests[ws.id]) {
            console.log("Guest disconnected:", ws.id);
            delete guests[ws.id];
        }
    });
});

console.log("Signaling server running on ws://localhost:8080");
