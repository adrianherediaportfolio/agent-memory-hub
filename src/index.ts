import express from "express";
import cors from "cors";
import router from "./routes";
import { closeDatabase } from "./database";

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// API routes
app.use("/api/v1", router);

// Root redirect to health
app.get("/", (_req, res) => {
  res.redirect("/api/v1/health");
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Agent Memory Hub running on http://0.0.0.0:${PORT}`);
  console.log(`API docs: http://localhost:${PORT}/api/v1/health`);
});

// Graceful shutdown
function shutdown() {
  console.log("\nShutting down...");
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
