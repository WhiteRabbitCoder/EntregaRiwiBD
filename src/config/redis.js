const { createClient } = require("redis");
const { env } = require("./env");

let clientPromise;

async function getRedisClient() {
  if (!env.REDIS_URL) return null;
  if (!clientPromise) {
    const client = createClient({ url: env.REDIS_URL });
    client.on("error", (err) => {
      console.error("Redis error", err.message);
    });
    clientPromise = client
      .connect()
      .then(() => client)
      .catch((error) => {
        console.error("Redis connection failed", error.message);
        clientPromise = null;
        return null;
      });
  }
  return clientPromise;
}

async function cacheGet(key) {
  const client = await getRedisClient();
  if (!client) return null;
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error("Redis get failed", error.message);
    return null;
  }
}

async function cacheSet(key, value, ttlSeconds) {
  const client = await getRedisClient();
  if (!client) return;
  try {
    const payload = JSON.stringify(value);
    if (ttlSeconds) {
      await client.set(key, payload, { EX: ttlSeconds });
    } else {
      await client.set(key, payload);
    }
  } catch (error) {
    console.error("Redis set failed", error.message);
  }
}

async function cacheDelByPattern(pattern) {
  const client = await getRedisClient();
  if (!client) return 0;
  let cursor = 0;
  let deleted = 0;
  do {
    const reply = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
    cursor = Number(reply.cursor);
    if (reply.keys && reply.keys.length) {
      const results = await client.del(...reply.keys);
      deleted += results;
    }
  } while (cursor !== 0);
  return deleted;
}

module.exports = { cacheGet, cacheSet, cacheDelByPattern, getRedisClient };
