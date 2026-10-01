import "dotenv/config";
import app from "./app.js";
import { emailWorker } from "./workers/email.worker.js";

const PORT = Number(process.env.PORT ?? 5000);

const server = app.listen(PORT, () => {
  console.log(`ReachInbox backend running on http://localhost:${PORT}`);
  console.log(`BullMQ email worker started with concurrency ${emailWorker.opts.concurrency ?? 1}.`);
});

const shutdown = async (signal: string) => {
  console.log(`${signal} received. Shutting down gracefully...`);

  await emailWorker.close();

  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});