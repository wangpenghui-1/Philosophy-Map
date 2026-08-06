import { closeWorkerDatabase, processOutboxBatch } from "./outbox.ts";

try {
  const result = await processOutboxBatch();
  console.log(JSON.stringify(result, null, 2));
} finally {
  await closeWorkerDatabase();
}
