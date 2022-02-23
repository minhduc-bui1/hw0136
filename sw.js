/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const VERSION = "0.1.36";
const GLOBAL_HASH = "300164107";
const UNHASHED_PRECACHED_ASSETS = ["index.html"];
const HASHED_PRECACHED_ASSETS = ["olm-1421970081.js","olm-4289088762.wasm","hydrogen-647332873.js","download-sandbox-3001206039.html","themes/element/element-logo-2959259787.svg","themes/element/icons/chevron-left-1539668473.svg","themes/element/icons/chevron-right-787082136.svg","themes/element/icons/clear-2843548839.svg","themes/element/icons/disable-grid-2157868734.svg","themes/element/icons/dismiss-1031249481.svg","themes/element/icons/enable-grid-3565802253.svg","themes/element/icons/paperclip-503625323.svg","themes/element/icons/search-1193336244.svg","themes/element/icons/send-4065347741.svg","themes/element/icons/settings-3021269543.svg","hydrogen-2668844176.css","themes/element/bundle-1921906448.css","themes/bubbles/bundle-1494402621.css","icon-2793984973.png","icon-maskable-317721575.png"];
const HASHED_CACHED_ON_REQUEST_ASSETS = ["olm_legacy-3232457086.js","hydrogen-legacy-3853453113.js","worker-3696849156.js","themes/element/inter/Inter-Black-276207522.woff","themes/element/inter/Inter-Black-3721205557.woff2","themes/element/inter/Inter-BlackItalic-3159247813.woff","themes/element/inter/Inter-BlackItalic-3355577873.woff2","themes/element/inter/Inter-Bold-4187626158.woff","themes/element/inter/Inter-Bold-1381170295.woff2","themes/element/inter/Inter-BoldItalic-641187949.woff","themes/element/inter/Inter-BoldItalic-4000810957.woff2","themes/element/inter/Inter-ExtraBold-3888913940.woff","themes/element/inter/Inter-ExtraBold-2973547570.woff2","themes/element/inter/Inter-ExtraBoldItalic-2880676406.woff","themes/element/inter/Inter-ExtraBoldItalic-4023252294.woff2","themes/element/inter/Inter-ExtraLight-3277895962.woff","themes/element/inter/Inter-ExtraLight-3116834956.woff2","themes/element/inter/Inter-ExtraLightItalic-3022762143.woff","themes/element/inter/Inter-ExtraLightItalic-542652406.woff2","themes/element/inter/Inter-Italic-4024721388.woff","themes/element/inter/Inter-Italic-2832519998.woff2","themes/element/inter/Inter-Light-3990448997.woff","themes/element/inter/Inter-Light-3879803958.woff2","themes/element/inter/Inter-LightItalic-412813693.woff","themes/element/inter/Inter-LightItalic-1187583345.woff2","themes/element/inter/Inter-Medium-2285329551.woff","themes/element/inter/Inter-Medium-1918055220.woff2","themes/element/inter/Inter-MediumItalic-1722521156.woff","themes/element/inter/Inter-MediumItalic-2244299954.woff2","themes/element/inter/Inter-Regular-2779214592.woff","themes/element/inter/Inter-Regular-441590695.woff2","themes/element/inter/Inter-SemiBold-1906312195.woff","themes/element/inter/Inter-SemiBold-2507251795.woff2","themes/element/inter/Inter-SemiBoldItalic-3778207334.woff","themes/element/inter/Inter-SemiBoldItalic-152029837.woff2","themes/element/inter/Inter-Thin-1593561269.woff","themes/element/inter/Inter-Thin-1469368522.woff2","themes/element/inter/Inter-ThinItalic-1888295987.woff","themes/element/inter/Inter-ThinItalic-173059207.woff2","manifest-1157650900.json"];
const unhashedCacheName = `hydrogen-assets-${GLOBAL_HASH}`;
const hashedCacheName = `hydrogen-assets`;
const mediaThumbnailCacheName = `hydrogen-media-thumbnails-v2`;

self.addEventListener('install', function(e) {
    e.waitUntil((async () => {
        const unhashedCache = await caches.open(unhashedCacheName);
        await unhashedCache.addAll(UNHASHED_PRECACHED_ASSETS);
        const hashedCache = await caches.open(hashedCacheName);
        await Promise.all(HASHED_PRECACHED_ASSETS.map(async asset => {
            if (!await hashedCache.match(asset)) {
                await hashedCache.add(asset);
            }
        }));
    })());
});

async function purgeOldCaches() {
    // remove any caches we don't know about
    const keyList = await caches.keys();
    for (const key of keyList) {
        if (key !== unhashedCacheName && key !== hashedCacheName && key !== mediaThumbnailCacheName) {
            await caches.delete(key);
        }
    }
    // remove the cache for any old hashed resource
    const hashedCache = await caches.open(hashedCacheName);
    const keys = await hashedCache.keys();
    const hashedAssetURLs =
        HASHED_PRECACHED_ASSETS
        .concat(HASHED_CACHED_ON_REQUEST_ASSETS)
        .map(a => new URL(a, self.registration.scope).href);

    for (const request of keys) {
        if (!hashedAssetURLs.some(url => url === request.url)) {
            hashedCache.delete(request);
        }
    }
}

self.addEventListener('activate', (event) => {
    event.waitUntil(Promise.all([
        purgeOldCaches(),
        // on a first page load/sw install,
        // start using the service worker on all pages straight away
        self.clients.claim()
    ]));
});

self.addEventListener('fetch', (event) => {
    event.respondWith(handleRequest(event.request));
});

function isCacheableThumbnail(url) {
    if (url.pathname.startsWith("/_matrix/media/r0/thumbnail/")) {
        const width = parseInt(url.searchParams.get("width"), 10);
        const height = parseInt(url.searchParams.get("height"), 10);
        if (width <= 50 && height <= 50) {
            return true;
        }
    }
    return false;
}

const baseURL = new URL(self.registration.scope);
async function handleRequest(request) {
    try {
        const url = new URL(request.url);
        if (url.origin === baseURL.origin && url.pathname === baseURL.pathname) {
            request = new Request(new URL("index.html", baseURL.href));
        }
        let response = await readCache(request);
        if (!response) {
            // use cors so the resource in the cache isn't opaque and uses up to 7mb
            // https://developers.google.com/web/tools/chrome-devtools/progressive-web-apps?utm_source=devtools#opaque-responses
            if (isCacheableThumbnail(url)) {
                response = await fetch(request, {mode: "cors", credentials: "omit"});
            } else {
                response = await fetch(request);
            }
            await updateCache(request, response);
        }
        return response;
    } catch (err) {
        if (!(err instanceof TypeError)) {
            console.error("error in service worker", err);
        }
        throw err;
    }
}

async function updateCache(request, response) {
    // don't write error responses to the cache
    if (response.status >= 400) {
        return;
    }
    const url = new URL(request.url);
    const baseURL = self.registration.scope;
    if (isCacheableThumbnail(url)) {
        const cache = await caches.open(mediaThumbnailCacheName);
        cache.put(request, response.clone());
    } else if (request.url.startsWith(baseURL)) {
        let assetName = request.url.substr(baseURL.length);
        if (HASHED_CACHED_ON_REQUEST_ASSETS.includes(assetName)) {
            const cache = await caches.open(hashedCacheName);
            await cache.put(request, response.clone());
        }
    }
}

async function readCache(request) {
    const unhashedCache = await caches.open(unhashedCacheName);
    let response = await unhashedCache.match(request);
    if (response) {
        return response;
    }
    const hashedCache = await caches.open(hashedCacheName);
    response = await hashedCache.match(request);
    if (response) {
        return response;
    }
    
    const url = new URL(request.url);
    if (isCacheableThumbnail(url)) {
        const mediaThumbnailCache = await caches.open(mediaThumbnailCacheName);
        response = await mediaThumbnailCache.match(request);
        // added in 0.1.26, remove previously cached error responses, remove this in some time
        if (response?.status >= 400) {
            await mediaThumbnailCache.delete(request);
            response = null;
        }
    }
    return response;
}

self.addEventListener('message', (event) => {
    const reply = payload => event.source.postMessage({replyTo: event.data.id, payload});
    const {replyTo} = event.data;
    if (replyTo) {
        const resolve = pendingReplies.get(replyTo);
        if (resolve) {
            pendingReplies.delete(replyTo);
            resolve(event.data.payload);
        }
    } else {
        switch (event.data?.type) {
            case "version":
                reply({version: VERSION, buildHash: GLOBAL_HASH});
                break;
            case "skipWaiting":
                self.skipWaiting();
                break;
            case "closeSession":
                event.waitUntil(
                    closeSession(event.data.payload.sessionId, event.source.id)
                        .then(() => reply())
                );
                break;
        }
    }
});


async function closeSession(sessionId, requestingClientId) {
    const clients = await self.clients.matchAll();
    await Promise.all(clients.map(async client => {
        if (client.id !== requestingClientId) {
            await sendAndWaitForReply(client, "closeSession", {sessionId});
        }
    }));
}

const pendingReplies = new Map();
let messageIdCounter = 0;
function sendAndWaitForReply(client, type, payload) {
    messageIdCounter += 1;
    const id = messageIdCounter;
    const promise = new Promise(resolve => {
        pendingReplies.set(id, resolve);
    });
    client.postMessage({type, id, payload});
    return promise;
}
