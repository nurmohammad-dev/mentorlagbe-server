import express from "express";
import "dotenv/config";
import cors from "cors";
import { connectToMongoDB } from "./config/db.js";
import usersRoutes from "./routes/users.routes.js";
import tuitionsRoutes from "./routes/tuitions.routes.js";
import applicationsRoutes from "./routes/applications.routes.js";




const app = express();
const PORT = process.env.PORT || 5000;

// Basic middlewares
app.use(cors());
app.use(express.json());

// Connect to MongoDB when the server starts
await connectToMongoDB();

// Routes
app.use("/api/users", usersRoutes);
app.use("/api/tuitions", tuitionsRoutes);
app.use("/api/applications", applicationsRoutes);


app.get("/", (req, res) => {
  res.send("MentorLagbe Server is running!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});