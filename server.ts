import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db.js";
import { MessagingApiClient } from "./line-client.js";
import { Repository } from "./repositories.js";
import { WebhookService } from "./webhook-service.js";

const config = loadConfig();
const pool = createPool(config);
const repository = new Repository(pool);
const lineClient = new MessagingApiClient(config.LINE_CHANNEL_ACCESS_TOKEN);
const webhookService = new WebhookService(repository, lineClient, config);
const app = createApp(config, pool, repository, webhookService);

const server = app.listen(config.PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${config.PORT}`);
});

async function shutdown(): Promise<void> {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
