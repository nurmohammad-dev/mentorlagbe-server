import express from "express";
import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyAdmin } from "../middlewares/verifyRole.js";

const router = express.Router();

// 1. Get current logged-in user's profile (auto-syncs to 'users' collection if new)
router.get("/me", verifyToken, async (req, res) => {
  try {
    const { usersCollection } = await getCollections();
    const { email, name, image, role } = req.user;

    let user = await usersCollection.findOne({ email });

    if (!user) {
      const newUser = {
        name: name || "User",
        email,
        image: image || "",
        role: role || "student",
        plan: "free",
        phone: "",
        bio: "",
        createdAt: new Date(),
      };
      const result = await usersCollection.insertOne(newUser);
      user = { _id: result.insertedId, ...newUser };
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user profile" });
  }
});

// 2. Update logged-in user's own profile
router.patch("/profile", verifyToken, async (req, res) => {
  try {
    const { usersCollection } = await getCollections();
    const email = req.user.email;
    const { name, phone, bio, image } = req.body;

    const updatedFields = {
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(bio !== undefined && { bio }),
      ...(image !== undefined && { image }),
      updatedAt: new Date(),
    };

    await usersCollection.updateOne(
      { email },
      {
        $set: updatedFields,
        $setOnInsert: {
          email,
          role: req.user.role || "student",
          plan: "free",
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    const updatedUser = await usersCollection.findOne({ email });
    res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// 3. Get all users (Admin only)
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { usersCollection } = await getCollections();
    const users = await usersCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// 4. Update a user's role (Admin only)
router.patch("/:id/role", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const allowedRoles = ["student", "tutor", "admin"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role specified" });
    }

    const { usersCollection } = await getCollections();
    const targetUser = await usersCollection.findOne({ _id: new ObjectId(id) });

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (targetUser.email === req.user.email && role !== "admin") {
      return res
        .status(400)
        .json({ message: "You cannot remove your own admin role" });
    }

    await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { role, updatedAt: new Date() } }
    );

    res.json({ message: `User role updated to ${role}` });
  } catch (err) {
    res.status(500).json({ message: "Failed to update user role" });
  }
});

export default router;