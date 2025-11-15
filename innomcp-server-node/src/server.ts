import "dotenv/config";
import http from "http";
import net from "net";
import url from "url";
import dotenv from "dotenv";

import app from "./app";

dotenv.config();

const host = process.env.SERVER_HOST || "0.0.0.0";
const port = parseInt(process.env.SERVER_PORT || "3010", 10);

const server = http.createServer(app);

server.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`);
});

export default server;
