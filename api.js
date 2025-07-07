const express = require("express");
const serverless = require("serverless-http");
require("dotenv").config();

const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(express.static("public"));

try {
  app.use("/auth", require("./routes/auth"));
  app.use("/leads", require("./routes/leads"));
  app.use("/applications", require("./routes/applications"));
  app.use("/profile", require("./routes/profile"));
  app.use("/settings", require("./routes/settings"));
  app.use("/users", require("./routes/users"));
  app.use("/setup", require("./routes/setup"));
  app.use("/credits", require("./routes/credits"));
  console.log("All routes loaded successfully");
} catch (error) {
  console.error("Error loading routes:", error);
}

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

app.use((req, res, next) => {
  res.status(404).json({ error: "Not Found", message: `Cannot ${req.method} ${req.url}` });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "production" ? "Something went wrong" : err.message,
  });
});

module.exports = serverless(app);
