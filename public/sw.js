/**
 * SnapyForm Service Worker — Offline Submission Support
 * Caches static assets and queues form submissions when offline
 */

const CACHE_NAME = 'snapyform-v1';
const OFFLINE_QUEUE_KEY = 'sf_offline_queue';

// Assets to cache for offline use
const STATIC_ASSETS = [
    '/',
    '/styles/main.css',
    '/js/api.js',
    '/js/ai.js',
    '/login',
    '/register',
    '/offline.html'
];

// ── Install: cache static assets ────────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => { }))
    );
    self.skipWaiting();
});

// ── Activate: clean old caches ──────────────────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ── Fetch: intercept requests ───────────────────────────────────────────
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Intercept form submission POSTs when offline
    if (event.request.method === 'POST' &&
        (url.pathname.endsWith('/submit') || url.pathname.includes('/api/forms/') && url.pathname.endsWith('/submit'))) {
        event.respondWith(handleSubmit(event.request));
        return;
    }

    // For API calls: try network first, don't cache
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() =>
                new Response(JSON.stringify({ error: 'You are offline. Please check your internet connection.' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
        );
        return;
    }

    // For static assets: cache first
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (!response || response.status !== 200) return response;
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            }).catch(async () => {
                // Return offline page for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('/offline.html') ||
                        new Response('<h1>SnapyForm — You are offline</h1>', { headers: { 'Content-Type': 'text/html' } });
                }
            });
        })
    );
});

// ── Handle form submission when offline ─────────────────────────────────
async function handleSubmit(request) {
    try {
        // Try online first
        const response = await fetch(request.clone());
        return response;
    } catch (err) {
        // We're offline — queue the submission
        try {
            const body = await request.json();
            const url = new URL(request.url);
            const formId = url.pathname.split('/').find((_, i, a) => a[i - 1] === 'forms');
            const queue = await getQueue();
            queue.push({
                formId: formId || body.formId,
                data: body,
                submittedAt: new Date().toISOString(),
                queuedAt: new Date().toISOString()
            });
            await saveQueue(queue);
            // Notify clients
            self.clients.matchAll().then(clients => {
                clients.forEach(c => c.postMessage({ type: 'SUBMISSION_QUEUED', count: queue.length }));
            });
            return new Response(JSON.stringify({
                success: true,
                offline: true,
                queued: true,
                message: 'You are offline. Your response has been saved and will be submitted when you reconnect.',
                queueLength: queue.length
            }), { status: 202, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ error: 'Failed to queue submission: ' + e.message }), {
                status: 500, headers: { 'Content-Type': 'application/json' }
            });
        }
    }
}

// ── Queue management ─────────────────────────────────────────────────────
async function getQueue() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const resp = await cache.match('/_offline_queue');
        if (!resp) return [];
        return await resp.json();
    } catch { return []; }
}

async function saveQueue(queue) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put('/_offline_queue', new Response(JSON.stringify(queue), { headers: { 'Content-Type': 'application/json' } }));
}

// ── Background sync when reconnected ─────────────────────────────────────
self.addEventListener('sync', async event => {
    if (event.tag === 'sync-responses') {
        event.waitUntil(syncQueuedResponses());
    }
});

async function syncQueuedResponses() {
    const queue = await getQueue();
    if (!queue.length) return;
    const synced = [], failed = [];
    for (const item of queue) {
        try {
            const r = await fetch('/api/offline/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissions: [item] })
            });
            if (r.ok) synced.push(item);
            else failed.push(item);
        } catch { failed.push(item); }
    }
    await saveQueue(failed);
    // Notify clients of sync result
    self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'SYNC_COMPLETE', synced: synced.length, failed: failed.length }));
    });
}

// ── Message handling from main thread ────────────────────────────────────
self.addEventListener('message', async event => {
    if (event.data?.type === 'GET_QUEUE') {
        const q = await getQueue();
        event.source.postMessage({ type: 'QUEUE_DATA', queue: q });
    }
    if (event.data?.type === 'MANUALLY_SYNC') {
        await syncQueuedResponses();
    }
});
