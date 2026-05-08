require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const superRoutes = require("./routes/super.routes");
const adminRoutes = require("./routes/admin.routes");
const userRoutes = require("./routes/user.routes");

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Routes
app.use("/auth", authRoutes);
app.use("/super", superRoutes);
app.use("/admin", adminRoutes);
app.use("/user", userRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
