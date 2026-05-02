"use strict";

// Open viewer when toolbar icon is clicked
chrome.action.onClicked.addListener((tab) => {
    console.log('Toolbar icon clicked, opening viewer...');
    chrome.tabs.create({
        url: 'viewer.html'
    });
});
