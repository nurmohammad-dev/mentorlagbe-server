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

app.use(cors());

// Stripe Webhook MUST come before express.json()
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});