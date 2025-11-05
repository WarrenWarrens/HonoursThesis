document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("toggleCapture");

    button.addEventListener("click", () => {
        console.log("Opening capture page...");
        browser.tabs.create({ url: browser.runtime.getURL("capture.html") });
    });
});
