import express from "express";
import "dotenv/config";
import cors from "cors";
import { connectToMongoDB } from "./config/db.js";
import usersRoutes from "./routes/users.routes.js";
import tuitionsRoutes from "./routes/tuitions.routes.js";
import applicationsRoutes from "./routes/applications.routes.js";
import paymentsRoutes, {
  stripeWebhookHandler,
} from "./routes/payments.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Restrict CORS to trusted frontend origins
const allowedOrigins = [
  "http://localhost:3000",
  process.env.BETTER_AUTH_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like Postman/curl/server-to-server) or whitelisted origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use(express.json());

// Connect to MongoDB
await connectToMongoDB();

// API Routes
app.use("/api/users", usersRoutes);
app.use("/api/tuitions", tuitionsRoutes);
app.use("/api/applications", applicationsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Health check route
app.get("/", (req, res) => {
  res.send("MentorLagbe Server is running!");
});

// 404 Handler for unknown API routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});