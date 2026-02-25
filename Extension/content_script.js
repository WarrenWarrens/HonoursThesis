const colorMap = {
    red: '#ff0000',
    blue: '#0066ff',
    green: '#00ff00'
};

const style = document.createElement('style');
style.textContent = `
    @keyframes streamer-marker-pulse {
        0%, 100% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(1.3); }
    }
`;
document.head.appendChild(style);

browser.runtime.onMessage.addListener((msg) => {
    if (msg.type === "SHOW_MARKER" && msg.data) {
        const { xPercent, yPercent, color } = msg.data;
        const markerColor = colorMap[color] || '#ff0000';

        const x = (xPercent / 100) * window.innerWidth;
        const y = (yPercent / 100) * window.innerHeight;

        const marker = document.createElement("div");
        marker.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            width: 30px;
            height: 30px;
            background-color: ${markerColor};
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 0 15px ${markerColor};
            z-index: 2147483647;
            pointer-events: none;
            transform: translate(-50%, -50%);
            animation: streamer-marker-pulse 0.5s ease-in-out;
        `;

        if (msg.message) {
            const label = document.createElement("div");
            label.textContent = msg.message;
            label.style.cssText = `
                position: absolute;
                bottom: 36px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.75);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                font-family: sans-serif;
            `;
            marker.appendChild(label);
        }

        document.body.appendChild(marker);

        setTimeout(() => {
            marker.style.transition = "opacity 0.5s";
            marker.style.opacity = "0";
            setTimeout(() => marker.remove(), 500);
        }, 5000);
    }
});