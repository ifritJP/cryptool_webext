"use strict";

// Open the viewer (options page) when the extension icon is clicked
chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});
