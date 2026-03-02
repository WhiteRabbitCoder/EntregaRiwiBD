const { MongoClient } = require("mongodb");
const { env } = require("./env");

let client;
let db;

async function getMongoDb() {
  if (db) return db;
  client = new MongoClient(env.MONGODB_URI, {
    maxPoolSize: 10,
  });
  await client.connect();
  db = client.db(env.MONGODB_DB);
  return db;
}

async function closeMongo() {
  if (client) {
    await client.close();
  }
}

module.exports = { getMongoDb, closeMongo };
