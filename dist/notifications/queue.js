import PQueue from 'p-queue';
const queues = new Map();
export function getQueue(name, concurrency = 2) {
    const existing = queues.get(name);
    if (existing)
        return existing;
    const q = new PQueue({ concurrency });
    queues.set(name, q);
    return q;
}
export async function withRetries(fn, retries = 3, delays = [500, 1500, 3500]) {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        }
        catch (err) {
            lastError = err;
            const delay = delays[i] || delays[delays.length - 1];
            await new Promise((res) => setTimeout(res, delay));
        }
    }
    throw lastError;
}
