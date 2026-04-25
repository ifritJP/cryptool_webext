"use strict";

document.getElementById('open-viewer').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close(); // Close the popup menu
});
