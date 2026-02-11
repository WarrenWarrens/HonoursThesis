// This runs on every page the user visits
const colorMap = {
    red: '#ff0000',
    blue: '#0066ff',
    green: '#00ff00'
};

// Listen for messages from the capture/background script
browser.runtime.onMessage.addListener((request) => {
    if (request.type === "SHOW_MARKER") {
        showMarkerOnPage(
            request.data.xPercent,
            request.data.yPercent,
            request.message,
            request.data.color
        );
    }
});

function showMarkerOnPage(xPercent, yPercent, message, color) {
    const markerColor = colorMap[color] || '#ff0000';

    const marker = document.createElement("div");
    marker.style.position = "fixed"; // Fixed ensures it stays in place even if they scroll
    marker.style.width = "30px";
    marker.style.height = "30px";
    marker.style.backgroundColor = markerColor;
    marker.style.borderRadius = "50%";
    marker.style.border = "3px solid white";
    marker.style.boxShadow = `0 0 15px ${markerColor}`;
    marker.style.zIndex = "2147483647"; // Max z-index to stay on top of everything
    marker.style.pointerEvents = "none";

    // Calculate position based on the current window size (viewport)
    const markerX = (xPercent / 100) * window.innerWidth;
    const markerY = (yPercent / 100) * window.innerHeight;

    marker.style.left = `${markerX}px`;
    marker.style.top = `${markerY}px`;
    marker.style.transform = "translate(-50%, -50%)";

    // Add text label if needed
    if (message) {
        const label = document.createElement("div");
        label.textContent = message;
        label.style.position = "absolute";
        label.style.top = "-25px";
        label.style.left = "50%";
        label.style.transform = "translateX(-50%)";
        label.style.backgroundColor = "rgba(0,0,0,0.8)";
        label.style.color = "white";
        label.style.padding = "2px 6px";
        label.style.borderRadius = "4px";
        label.style.fontSize = "12px";
        label.style.whiteSpace = "nowrap";
        marker.appendChild(label);
    }

    document.body.appendChild(marker);

    // Animation
    marker.animate([
        { transform: "translate(-50%, -50%) scale(1)" },
        { transform: "translate(-50%, -50%) scale(1.3)" },
        { transform: "translate(-50%, -50%) scale(1)" }
    ], {
        duration: 500,
        iterations: 1
    });

    // Remove after 5 seconds
    setTimeout(() => {
        marker.style.transition = "opacity 0.5s";
        marker.style.opacity = "0";
        setTimeout(() => marker.remove(), 500);
    }, 5000);
}