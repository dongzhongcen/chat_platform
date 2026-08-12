import "dotenv/config";
import { format, transports } from "winston";
import { createServer } from "node:http";
import { createApp, logger } from "./src/index.js";

logger.add(
  new transports.Console({
    format: format.combine(format.colorize(), format.splat(), format.simple()),
  }),
);

const httpServer = createServer();

await createApp(httpServer, {
  mysql: {
    host: process.env.MYSQL_HOST ?? "127.0.0.1",
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE ?? "socketio_chat",
  },
  sessionSecrets: [process.env.SESSION_SECRET ?? "changeit-dev-only"],
  cors: {
    origin: ["http://localhost:5173", "http://localhost:8090"],
    credentials: true,
  },
});

httpServer.listen(3000, () => {
  logger.info("server listening at http://localhost:3000");
});
