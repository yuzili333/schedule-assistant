import { createAgentServiceApp } from "../server.js";
import { loadAgentServiceConfig } from "../config.js";

const app = createAgentServiceApp();
const config = loadAgentServiceConfig();

const server = app.listen(config.port, config.host, () => {
  console.log(`agent-service listening on ${config.host}:${config.port}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `agent-service failed to start: ${config.host}:${config.port} is already in use.`,
    );
    process.exit(1);
  }

  if (error.code === "EPERM") {
    console.error(
      `agent-service failed to start: the current environment does not permit listening on ${config.host}:${config.port}.`,
    );
    process.exit(1);
  }

  console.error("agent-service failed to start:", error);
  process.exit(1);
});
