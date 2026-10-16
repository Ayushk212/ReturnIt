import { MongoMemoryReplSet } from 'mongodb-memory-server';

console.log('Starting local MongoDB replica set (rs0)...');

const replSet = await MongoMemoryReplSet.create({
  instanceOpts: [
    {
      port: 27017,
      dbName: 'returnit',
    },
  ],
  replSet: {
    name: 'rs0',
    count: 1,
  },
});

console.log(`[MongoDB] Running on ${replSet.getUri()}`);
console.log('[MongoDB] Ready to accept connections.');

const shutdown = async () => {
  console.log('[MongoDB] Stopping replica set...');
  await replSet.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
