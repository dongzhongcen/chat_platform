import { createApp, logger } from "./src/index.js";
import { createServer } from "node:http";
import { format, transports } from "winston";

logger.add(
  new transports.Console({
    format: format.combine(format.timestamp(), format.splat(), format.json()),
  }),
);

const httpServer = createServer();

const { close } = await createApp(httpServer, {
  mysql: {
    host: process.env.MYSQL_HOST ?? "mysql",
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? "chat",
    password: process.env.MYSQL_PASSWORD ?? "changeit",
    database: process.env.MYSQL_DATABASE ?? "socketio_chat",
  },
  sessionSecrets: [process.env.SESSION_SECRET ?? "changeit-dev-only"],
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM signal received");

  await close();
});

httpServer.listen(3000, () => {
  logger.info("server listening at http://localhost:3000");
});
