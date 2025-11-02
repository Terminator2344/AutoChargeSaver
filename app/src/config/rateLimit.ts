type Bucket = { tokens: number; lastRefill: number; capacity: number; refillPerSec: number };

const buckets = new Map<string, Bucket>();

function getBucket(key: string, capacity = 10, refillPerSec = 1): Bucket {
  const existing = buckets.get(key);
  if (existing) return existing;
  const bucket: Bucket = { tokens: capacity, lastRefill: Date.now(), capacity, refillPerSec };
  buckets.set(key, bucket);
  return bucket;
}

export function takeToken(key: string, capacity?: number, refillPerSec?: number): boolean {
  const bucket = getBucket(key, capacity, refillPerSec);
  const now = Date.now();
  const delta = (now - bucket.lastRefill) / 1000;
  const refill = Math.floor(delta * bucket.refillPerSec);
  if (refill > 0) {
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + refill);
    bucket.lastRefill = now;
  }
  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}




