import express from "express";
import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyTutor, verifyAdmin } from "../middlewares/verifyRole.js";

const router = express.Router();

// 1. Public: Get approved & active tuitions with search, filter, sort & pagination
router.get("/", async (req, res) => {
  try {
    const { tuitionsCollection } = await getCollections();
    const {
      search = "",
      q = "",
      subject = "",
      classLevel = "",
      mode = "",
      minFee = "",
      maxFee = "",
      sort = "newest",
      page = 1,
      limit = 9,
    } = req.query;

    const searchTerm = search || q;

    const andConditions = [
      { $or: [{ approvalStatus: "approved" }, { status: "approved" }] },
      { isActive: true },
    ];

    if (searchTerm) {
      andConditions.push({
        $or: [
          { title: { $regex: searchTerm, $options: "i" } },
          { subject: { $regex: searchTerm, $options: "i" } },
          { location: { $regex: searchTerm, $options: "i" } },
          { tutorName: { $regex: searchTerm, $options: "i" } },
        ],
      });
    }

    if (subject) {
      andConditions.push({ subject: { $regex: `^${subject}$`, $options: "i" } });
    }

    if (classLevel) {
      andConditions.push({
        classLevel: { $regex: `^${classLevel}$`, $options: "i" },
      });
    }

    if (mode) {
      andConditions.push({ mode: { $regex: `^${mode}$`, $options: "i" } });
    }

    if (minFee || maxFee) {
      const feeFilter = {};
      if (minFee) feeFilter.$gte = Number(minFee);
      if (maxFee) feeFilter.$lte = Number(maxFee);
      andConditions.push({ monthlyFee: feeFilter });
    }

    const query = { $and: andConditions };

    let sortOption = { createdAt: -1 };
    if (sort === "fee-asc") sortOption = { monthlyFee: 1 };
    if (sort === "fee-desc") sortOption = { monthlyFee: -1 };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 9);
    const skip = (pageNum - 1) * limitNum;

    const [tuitions, total] = await Promise.all([
      tuitionsCollection
        .find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      tuitionsCollection.countDocuments(query),
    ]);

    res.json({
      tuitions,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch tuitions" });
  }
});

// 2. Tutor: Get logged-in tutor's own tuitions
router.get("/my-tuitions", verifyToken, verifyTutor, async (req, res) => {
  try {
    const { tuitionsCollection } = await getCollections();
    const tuitions = await tuitionsCollection
      .find({ tutorEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(tuitions);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch your tuitions" });
  }
});

// 3. Admin: Get all tuitions for moderation
router.get("/admin/all", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { tuitionsCollection } = await getCollections();
    const tuitions = await tuitionsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(tuitions);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch all tuitions" });
  }
});

// 4. Public: Get single tuition details by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid tuition ID" });
    }

    const { tuitionsCollection } = await getCollections();
    const tuition = await tuitionsCollection.findOne({ _id: new ObjectId(id) });

    if (!tuition) {
      return res.status(404).json({ message: "Tuition not found" });
    }

    res.json(tuition);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch tuition details" });
  }
});

// 5. Tutor: Post a new tuition (Free plan limit: max 2 tuitions)
router.post("/", verifyToken, verifyTutor, async (req, res) => {
  try {
    const { usersCollection, tuitionsCollection } = await getCollections();
    const tutorEmail = req.user.email;

    const tutor = await usersCollection.findOne({ email: tutorEmail });
    const plan = tutor?.plan || "free";

    if (plan !== "pro") {
      const existingCount = await tuitionsCollection.countDocuments({
        tutorEmail,
      });
      if (existingCount >= 2) {
        return res.status(403).json({
          message:
            "Free plan limit reached (max 2 tuitions). Upgrade to Pro for unlimited posts.",
        });
      }
    }

    const {
      title,
      subject,
      classLevel,
      mode,
      location,
      daysPerWeek,
      schedule,
      monthlyFee,
      description,
      bannerImage,
      image,
    } = req.body;

    if (!title || !subject || !classLevel || !monthlyFee) {
      return res
        .status(400)
        .json({ message: "Title, subject, class level, and fee are required" });
    }

    const newTuition = {
      title,
      subject,
      classLevel,
      mode: mode || "Offline",
      location: location || "Dhaka",
      daysPerWeek: daysPerWeek || schedule || "3 days/week",
      monthlyFee: Number(monthlyFee),
      description: description || "",
      bannerImage: bannerImage || image || "",
      tutorName: tutor?.name || req.user.name || "Tutor",
      tutorEmail,
      tutorImage: tutor?.image || req.user.image || "",
      approvalStatus: "pending",
      isActive: true,
      createdAt: new Date(),
    };

    const result = await tuitionsCollection.insertOne(newTuition);
    res.status(201).json({
      message: "Tuition posted successfully and pending admin approval",
      tuition: { _id: result.insertedId, ...newTuition },
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to post tuition" });
  }
});

// 6. Tutor: Update own tuition
router.patch("/:id", verifyToken, verifyTutor, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid tuition ID" });
    }

    const { tuitionsCollection } = await getCollections();
    const existing = await tuitionsCollection.findOne({ _id: new ObjectId(id) });

    if (!existing) {
      return res.status(404).json({ message: "Tuition not found" });
    }

    if (existing.tutorEmail !== req.user.email) {
      return res
        .status(403)
        .json({ message: "Forbidden: You can only edit your own tuitions" });
    }

    const {
      title,
      subject,
      classLevel,
      mode,
      location,
      daysPerWeek,
      monthlyFee,
      description,
      bannerImage,
      isActive,
    } = req.body;

    const updatedFields = {
      ...(title !== undefined && { title }),
      ...(subject !== undefined && { subject }),
      ...(classLevel !== undefined && { classLevel }),
      ...(mode !== undefined && { mode }),
      ...(location !== undefined && { location }),
      ...(daysPerWeek !== undefined && { daysPerWeek }),
      ...(monthlyFee !== undefined && { monthlyFee: Number(monthlyFee) }),
      ...(description !== undefined && { description }),
      ...(bannerImage !== undefined && { bannerImage }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      updatedAt: new Date(),
    };

    await tuitionsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedFields }
    );

    res.json({ message: "Tuition updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update tuition" });
  }
});

// 7. Admin: Approve or reject a tuition
router.patch("/:id/status", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const nextStatus = req.body.approvalStatus || req.body.status;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid tuition ID" });
    }

    if (!["approved", "rejected"].includes(nextStatus)) {
      return res
        .status(400)
        .json({ message: "Status must be either 'approved' or 'rejected'" });
    }

    const { tuitionsCollection } = await getCollections();
    const result = await tuitionsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { approvalStatus: nextStatus, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Tuition not found" });
    }

    res.json({ message: `Tuition ${nextStatus} successfully` });
  } catch (err) {
    res.status(500).json({ message: "Failed to update tuition status" });
  }
});

// 8. Tutor: Delete own tuition
router.delete("/:id", verifyToken, verifyTutor, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid tuition ID" });
    }

    const { tuitionsCollection } = await getCollections();
    const existing = await tuitionsCollection.findOne({ _id: new ObjectId(id) });

    if (!existing) {
      return res.status(404).json({ message: "Tuition not found" });
    }

    if (existing.tutorEmail !== req.user.email) {
      return res
        .status(403)
        .json({ message: "Forbidden: You can only delete your own tuitions" });
    }

    await tuitionsCollection.deleteOne({ _id: new ObjectId(id) });
    res.json({ message: "Tuition deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete tuition" });
  }
});

export default router;