require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

const app = express();
const PORT = process.env.PORT || 3001;

console.log("Server environment check:");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);
console.log("FRONTEND_URL:", process.env.FRONTEND_URL);
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "Set" : "Not set");

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
  const authRoutes = require("./routes/auth");
  const leadsRoutes = require("./routes/leads");
  const applicationsRoutes = require("./routes/applications");
  const profileRoutes = require("./routes/profile");
  const settingsRoutes = require("./routes/settings");
  const userRoutes = require("./routes/users");
  const setupRoutes = require("./routes/setup");
  const creditRoutes = require("./routes/credits");

  app.use("/api/auth", authRoutes);
  app.use("/api/leads", leadsRoutes);
  app.use("/api/applications", applicationsRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/setup", setupRoutes);
  app.use("/api/credits", creditRoutes);
  
  console.log("Mounted /api/settings route");

  console.log("All routes loaded successfully");
} catch (error) {
  console.error("Error loading routes:", error);
  process.exit(1);
}

// Log registered routes
console.log(
  "Registered routes:",
  app._router.stack
    .filter((r) => r.route)
    .map((r) => r.route.path)
);

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;