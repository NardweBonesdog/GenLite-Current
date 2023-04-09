// Check the Local Storage for GenLite.UpdateTimestamp
let genliteUpdateTimestamp = localStorage.getItem('GenLite.UpdateTimestamp');
if (genliteUpdateTimestamp == null) {
    localStorage.setItem('GenLite.UpdateTimestamp', new Date(0).toString());

    // And set the timestamp to 0
    genliteUpdateTimestamp = localStorage.getItem('GenLite.UpdateTimestamp');
}

// Convert the timestamp to a Date object
let genliteUpdateTimestampDate = new Date(genliteUpdateTimestamp);

// Check the Local Storage for GenFanad.UpdateTimestamp
let genfanadUpdateTimestamp = localStorage.getItem('GenFanad.UpdateTimestamp');
if (genfanadUpdateTimestamp == null) {
    // If it doesn't exist, then create it
    localStorage.setItem('GenLite.UpdateTimestamp', new Date(0).toString());

    // And set the timestamp to 0
    genfanadUpdateTimestamp = localStorage.getItem('GenFanad.UpdateTimestamp');
}

// Convert the timestamp to a Date object
let genfanadUpdateTimestampDate = new Date(genfanadUpdateTimestamp);

// Do "HEAD" XMLHttpRequest to get the Last-Modified header
let genliteLastModified: Date;
let genfanadLastModified: Date;

let xhrGenfanadModified = new XMLHttpRequest();
xhrGenfanadModified.open('HEAD', 'https://play.genfanad.com/play/js/client.js', false);
xhrGenfanadModified.setRequestHeader("Cache-Control", "no-cache, no-store, must-revalidate");
xhrGenfanadModified.send(null);

let genfanadModifiedDate = xhrGenfanadModified.getResponseHeader('Last-Modified');
// Convert the Last-Modified header to a UNIX timestamp
if (genfanadModifiedDate == null || genfanadModifiedDate == undefined) {
    genfanadLastModified = new Date(0)
} else {
    genfanadLastModified = new Date(genfanadModifiedDate);
}

let xhrGenliteModified = new XMLHttpRequest();
xhrGenliteModified.open('GET', 'https://api.github.com/repos/dpeGit/GenLite/releases/latest', false);
xhrGenliteModified.setRequestHeader("Accept", "application/vnd.dpeGit.v3+json")
xhrGenliteModified.send(null);
let genliteAPIRespose = JSON.parse(xhrGenliteModified.responseText);


let genliteModifiedDate = genliteAPIRespose.published_at;
let genliteVersion = genliteAPIRespose.tag_name;

if (genliteModifiedDate == null || genliteModifiedDate == undefined) {
    genliteLastModified = new Date(0)
} else {
    genliteLastModified = new Date(genliteModifiedDate)
}

// Genfanad Client is always updated
let genfanadJS = localStorage.getItem('GenFanad.Client');
if (genfanadLastModified > genfanadUpdateTimestampDate) {
    localStorage.setItem('GenFanad.UpdateTimestamp', genfanadLastModified.toString());

    let xhrClientJS = new XMLHttpRequest();
    xhrClientJS.open("GET", "https://play.genfanad.com/play/js/client.js");
    xhrClientJS.onload = function () {
        if (xhrClientJS.status == 200) {
            genfanadJS = xhrClientJS.responseText;

            // Implement Work-Arounds for Closure
            genfanadJS = genfanadJS.replace(
                /import.meta.url/g,
                '("https://play.genfanad.com/play/js/client.js")'
            );
            genfanadJS = genfanadJS.substring(0, genfanadJS.length - 5)
                + "; document.client = {};"
                + "document.client.get = function(a) {"
                + "return eval(a);"
                + "};"
                + "document.client.set = function(a, b) {"
                + "eval(a + ' = ' + b);"
                + "};"
                + genfanadJS.substring(genfanadJS.length - 5)
                + "//# sourceURL=client.js";

            localStorage.setItem('GenFanad.Client', genfanadJS);

            // Place the modified client.js into the cache location for https://play.genfanad.com/play/js/client.js
            caches.open('genfanad').then(function (cache) {
                cache.put('https://play.genfanad.com/play/js/client.js', new Response(genfanadJS, {
                    headers: {
                        'Content-Type': 'application/javascript',
                        'Last-Modified': genfanadLastModified.toString()
                    }
                }));
            });

        } else {
            console.error("GenFanad Client.js failed to load. Status: " + xhrClientJS.status);
        }
    }
    xhrClientJS.send();
}

const needsUpdate = genliteLastModified > genliteUpdateTimestampDate;

if (needsUpdate) {
    // Wait for the DOM to get to a modifiable state
    document.addEventListener('DOMContentLoaded', () => {
        // Wipe the page
        document.documentElement.innerHTML = '';

        // Grab the ACME font from Google Fonts
        const acmeFont = document.createElement('link');
        acmeFont.rel = 'stylesheet';
        acmeFont.href = 'https://fonts.googleapis.com/css2?family=Acme&display=swap';
        document.head.appendChild(acmeFont);

        // Apply the font to the body
        document.body.style.fontFamily = 'Acme, sans-serif';

        // Make background black
        document.documentElement.style.backgroundColor = 'black';

        // Create a Backdrop
        const backdrop = document.createElement('div');
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100%';
        backdrop.style.height = '100%';
        backdrop.style.backgroundImage = 'url(https://i.imgur.com/KutJ1gO.png)';
        backdrop.style.zIndex = '99';
        backdrop.style.filter = 'blur(5px)';
        backdrop.style.backgroundSize = 'cover';
        backdrop.style.backgroundRepeat = 'no-repeat';
        backdrop.style.backgroundPosition = 'center';


        // Add the backdrop to the document
        document.body.appendChild(backdrop);

        // Darken the backdrop
        const backdropFilter = document.createElement('div');
        backdropFilter.style.position = 'absolute';
        backdropFilter.style.top = '0';
        backdropFilter.style.left = '0';
        backdropFilter.style.width = '100%';
        backdropFilter.style.height = '100%';
        backdropFilter.style.backgroundColor = 'black';
        backdropFilter.style.opacity = '0.5';

        // Blur the backdrop
        backdropFilter.style.filter = 'blur(5px)';
        backdrop.appendChild(backdropFilter);

        let modal = document.createElement('div');
        modal.id = 'genlite-confirm-modal';
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.width = '40%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.zIndex = '100';
        document.documentElement.appendChild(modal);

        let header = document.createElement('div');
        header.id = 'genlite-confirm-header';
        header.style.backgroundImage = 'url("https://genfanad-static.s3.us-east-2.amazonaws.com/versioned/0.120/data_client/img/new_ux/login_screen_images/generic_modal_top.png")';
        header.style.backgroundSize = '100%, 100%';
        header.style.width = '100%';
        header.style.aspectRatio = '2106/310'; // background png size
        modal.appendChild(header);

        let title = document.createElement('div');
        title.style.backgroundImage = 'url("https://genfanad-static.s3.us-east-2.amazonaws.com/versioned/0.120/data_client/img/new_ux/login_screen_images/modal_title.png")';
        title.style.position = 'fixed';
        title.style.width = '40%';
        title.style.aspectRatio = '632/120';
        title.style.backgroundSize = '100%, 100%';
        title.style.top = '0';
        title.style.left = '50%';
        title.style.transform = 'translate(-50%, -25%)';
        title.style.textAlign = 'center';
        title.style.textShadow = '-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000';
        title.style.fontFamily = 'acme,times new roman,Times,serif';
        title.style.fontSize = '1.5rem';
        title.style.color = 'white';
        title.style.overflow = 'hidden';

        title.style.display = 'flex';
        title.style.justifyContent = 'center';
        title.style.alignContent = 'center';
        title.style.flexDirection = 'column';

        title.innerText = 'GenLite is out of date!';
        header.appendChild(title);

        let body = document.createElement('div');
        body.id = 'genlite-confirm-body';
        body.style.backgroundImage = 'url("https://genfanad-static.s3.us-east-2.amazonaws.com/versioned/0.120/data_client/img/new_ux/login_screen_images/generic_modal_mid_and_bottom.png")';
        body.style.backgroundSize = '100%, 100%';
        body.style.width = '100%';
        body.style.aspectRatio = '2104/1316'; // background png size

        body.style.textAlign = 'center';
        body.style.textShadow = '-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000';
        body.style.fontFamily = 'acme,times new roman,Times,serif';
        body.style.fontSize = '1.5rem';
        body.style.color = 'white';
        modal.appendChild(body);

        let scrollBox = document.createElement('div');
        scrollBox.style.width = '90%';
        scrollBox.style.height = '75%';
        scrollBox.style.margin = 'auto';
        scrollBox.style.overflowY = 'scroll';
        body.appendChild(scrollBox);

        let warningText = document.createElement('span');
        warningText.style.display = 'inline-block';
        warningText.style.width = '75%';
        warningText.style.textAlign = 'center';
        warningText.style.paddingBottom = '2em';
        warningText.innerText = 'A new version of GenLite is available. It is highly recommended that you update to the latest version, as older versions may not work properly. If you choose to continue with this version, you may experience issues or bugs that have been fixed in the latest version. You will only be notified of this update once.';
        scrollBox.appendChild(warningText);

        // okay button actually cancels genlite
        let okayButton = document.createElement('div');
        okayButton.style.backgroundImage = 'url("https://genfanad-static.s3.us-east-2.amazonaws.com/versioned/0.120/data_client/img/new_ux/login_screen_images/return_button.png")';
        okayButton.style.backgroundSize = '100%, 100%';
        okayButton.style.width = '15%';
        okayButton.style.aspectRatio = '131/52'; // background png size
        okayButton.style.position = 'fixed';
        okayButton.style.top = '100%';
        okayButton.style.left = '40%';
        okayButton.style.transform = 'translate(-50%, -175%)';

        okayButton.style.display = 'flex';
        okayButton.style.justifyContent = 'center';
        okayButton.style.alignContent = 'center';
        okayButton.style.flexDirection = 'column';
        okayButton.style.cursor = 'pointer';
        okayButton.innerText = 'Update Now';
        okayButton.onclick = (e) => {
            localStorage.setItem('GenLite.UpdateTimestamp', genliteLastModified.toString());
            let xhrGenLiteJS = new XMLHttpRequest();
            xhrGenLiteJS.open("GET", "https://raw.githubusercontent.com/KKonaOG/GenLite/release/dist/genlite.user.js");
            xhrGenLiteJS.onload = function () {
                if (xhrGenLiteJS.status == 200) {
                    let genliteJS = xhrGenLiteJS.responseText;
                    localStorage.setItem('GenLite.Client', genliteJS);
                    localStorage.setItem('GenLite.Version', genliteVersion);
                    // Wait half a second before reloading the page
                    setTimeout(function () {
                        window.location.reload();
                    }, 100);
                }
            }
            xhrGenLiteJS.send();
        };
        scrollBox.appendChild(okayButton);

        // cancel button is actually the accept button
        let cancelButton = document.createElement('div');
        cancelButton.style.backgroundImage = 'url("https://genfanad-static.s3.us-east-2.amazonaws.com/versioned/0.120/data_client/img/new_ux/crafting/crafting_2/make_all.png")';
        cancelButton.style.backgroundSize = '100%, 100%';
        cancelButton.style.width = '15%';
        cancelButton.style.aspectRatio = '188/72'; // background png size
        cancelButton.style.position = 'fixed';
        cancelButton.style.top = '100%';
        cancelButton.style.left = '60%';
        cancelButton.style.transform = 'translate(-50%, -175%)';

        cancelButton.style.display = 'flex';
        cancelButton.style.justifyContent = 'center';
        cancelButton.style.alignContent = 'center';
        cancelButton.style.flexDirection = 'column';
        cancelButton.style.cursor = 'pointer';
        cancelButton.innerText = 'Remind Me Later';
        cancelButton.onclick = (e) => {
            localStorage.setItem('GenLite.UpdateTimestamp', genliteLastModified.toString());
            modal.remove();
        };
        scrollBox.appendChild(cancelButton);
    });
} else {
    // Retrieve GenLite.Client and GenLite.Version from local storage
    let genliteJS = localStorage.getItem('GenLite.Client');
    let genliteVersion = localStorage.getItem('GenLite.Version');

    // Wait for the page to load and be ready
    window.addEventListener('load', function () {
        // Load is fired off when the page is ready
        let version = document.createElement('p');
        version.innerText = 'GenLite Version:' + genliteVersion;
        version.id = 'genlite-version';
        version.style.padding = '0';
        version.style.margin = '0';

        // Get the span element with id loginversion
        let loginVersion = document.getElementById('loginversion');

        // Append the version span to the loginversion span
        loginVersion.appendChild(version);

    });

    // Execute genliteJS code using eval
    eval(genliteJS);
}
