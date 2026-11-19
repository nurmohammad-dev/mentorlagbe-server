import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let dbInstance = null;

// Connect to MongoDB once and reuse the database instance
export async function connectToMongoDB() {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    dbInstance = client.db("mentorlagbe_db");
    return dbInstance;
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    throw err;
  }
}

// Export all four collections required by the project
export async function getCollections() {
  const db = await connectToMongoDB();

  return {
    usersCollection: db.collection("users"),
    tuitionsCollection: db.collection("tuitions"),
    applicationsCollection: db.collection("applications"),
    paymentsCollection: db.collection("payments"),
  };
}