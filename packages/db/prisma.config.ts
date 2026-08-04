import path from "node:path";

import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({
  path: "../../apps/web/.env",
});

export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  // Prisma 7 removeu a URL do bloco `datasource` do schema; ela vive aqui e é
  // lida pelas CLIs (migrate, studio, generate). O runtime do cliente usa o
  // driver adapter em src/index.ts, não este arquivo.
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
});
