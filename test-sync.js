const { runSync } = require("./src/sync/sync");

async function test() {
  console.log("Running initial sync...");
  await runSync();
}

test().catch(console.error);
