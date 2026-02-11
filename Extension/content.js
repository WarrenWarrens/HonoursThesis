// Add a log to verify it loads
console.log("Stream Marker Content Script Loaded!");

const colorMap = { red: '#ff0000', blue: '#0066ff', green: '#00ff00' };

browser.runtime.onMessage.addListener((request) => {
    console.log("Content script received message:", request); // Debug log
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
    const marker = document.createElement("div");
    const markerColor = colorMap[color] || '#ff0000';

    // Style the marker
    marker.style.position = "fixed";
    marker.style.zIndex = "2147483647"; // Max Z-Index
    marker.style.left = `${xPercent}%`; // Use % directly for responsiveness
    marker.style.top = `${yPercent}%`;
    marker.style.width = "30px";
    marker.style.height = "30px";
    marker.style.backgroundColor = markerColor;
    marker.style.borderRadius = "50%";
    marker.style.border = "2px solid white";
    marker.style.transform = "translate(-50%, -50%)";
    marker.style.pointerEvents = "none"; // Let clicks pass through
    marker.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";

    if (message) {
        const label = document.createElement("span");
        label.textContent = message;
        label.style.position = "absolute";
        label.style.top = "-25px";
        label.style.left = "50%";
        label.style.transform = "translateX(-50%)";
        label.style.background = "rgba(0,0,0,0.8)";
        label.style.color = "white";
        label.style.padding = "2px 5px";
        label.style.borderRadius = "3px";
        label.style.fontSize = "12px";
        label.style.whiteSpace = "nowrap";
        marker.appendChild(label);
    }

    document.body.appendChild(marker);

    // Remove after 5 seconds
    setTimeout(() => marker.remove(), 5000);
}