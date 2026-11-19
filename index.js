import express from "express";
import "dotenv/config";
import cors from "cors";
import { connectToMongoDB } from "./config/db.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middlewares
app.use(cors());
app.use(express.json());

// Connect to MongoDB when the server starts
await connectToMongoDB();

// Health check route
app.get("/", (req, res) => {
  res.send("MentorLagbe Server is running!");
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});