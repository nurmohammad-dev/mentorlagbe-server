import express from "express";
import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyStudent, verifyTutor } from "../middlewares/verifyRole.js";

const router = express.Router();

// 1. Student: Apply to an approved & active tuition
router.post("/", verifyToken, verifyStudent, async (req, res) => {
  try {
    const {
      tuitionId,
      studentPhone,
      preferredSchedule,
      studentNote,
      studentName,
    } = req.body;

    if (!tuitionId || !ObjectId.isValid(tuitionId)) {
      return res.status(400).json({ message: "Valid tuition ID is required" });
    }

    if (!studentPhone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const { usersCollection, tuitionsCollection, applicationsCollection } =
      await getCollections();

    const studentEmail = req.user.email;
    const student = await usersCollection.findOne({ email: studentEmail });

    // Free plan students can apply to up to 5 tuitions; Pro plan has unlimited applications
    if ((student?.plan || "free") !== "pro") {
      const appliedCount = await applicationsCollection.countDocuments({
        studentEmail,
      });
      if (appliedCount >= 5) {
        return res.status(403).json({
          message:
            "Free plan limit reached (max 5 applications). Upgrade to Pro for unlimited applications.",
        });
      }
    }

    // Verify tuition exists and is open for applications
    const tuition = await tuitionsCollection.findOne({
      _id: new ObjectId(tuitionId),
    });

    if (!tuition) {
      return res.status(404).json({ message: "Tuition not found" });
    }

    if (tuition.status !== "approved" || !tuition.isActive) {
      return res
        .status(400)
        .json({ message: "This tuition is not accepting applications" });
    }

    // Prevent duplicate application by the same student
    const existingApplication = await applicationsCollection.findOne({
      tuitionId,
      studentEmail,
    });

    if (existingApplication) {
      return res
        .status(409)
        .json({ message: "You have already applied to this tuition" });
    }

    const newApplication = {
      tuitionId,
      tuitionTitle: tuition.title,
      subject: tuition.subject,
      monthlyFee: tuition.monthlyFee,
      tutorEmail: tuition.tutorEmail,
      tutorName: tuition.tutorName || "Tutor",
      studentName: studentName || student?.name || req.user.name || "Student",
      studentEmail,
      studentPhone,
      preferredSchedule: preferredSchedule || "",
      studentNote: studentNote || "",
      status: "pending",
      createdAt: new Date(),
    };

    const result = await applicationsCollection.insertOne(newApplication);
    res.status(201).json({
      message: "Application submitted successfully",
      application: { _id: result.insertedId, ...newApplication },
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to submit application" });
  }
});

// 2. Student: Get logged-in student's own applications
router.get("/my-applications", verifyToken, verifyStudent, async (req, res) => {
  try {
    const { applicationsCollection } = await getCollections();
    const applications = await applicationsCollection
      .find({ studentEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch your applications" });
  }
});

// 3. Student: Cancel own pending application
router.delete("/:id", verifyToken, verifyStudent, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid application ID" });
    }

    const { applicationsCollection } = await getCollections();
    const existing = await applicationsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!existing) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (existing.studentEmail !== req.user.email) {
      return res.status(403).json({
        message: "Forbidden: You can only cancel your own applications",
      });
    }

    if (existing.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Only pending applications can be cancelled" });
    }

    await applicationsCollection.deleteOne({ _id: new ObjectId(id) });
    res.json({ message: "Application cancelled successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to cancel application" });
  }
});

// 4. Tutor: Get all applications received for logged-in tutor's tuitions
router.get("/tutor", verifyToken, verifyTutor, async (req, res) => {
  try {
    const { applicationsCollection } = await getCollections();
    const applications = await applicationsCollection
      .find({ tutorEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch received applications" });
  }
});

// 5. Tutor: Accept or reject an application
router.patch("/:id/status", verifyToken, verifyTutor, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid application ID" });
    }

    if (!["accepted", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ message: "Status must be either 'accepted' or 'rejected'" });
    }

    const { applicationsCollection } = await getCollections();
    const existing = await applicationsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!existing) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (existing.tutorEmail !== req.user.email) {
      return res.status(403).json({
        message: "Forbidden: You can only manage applications for your tuitions",
      });
    }

    await applicationsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );

    res.json({ message: `Application ${status} successfully` });
  } catch (err) {
    res.status(500).json({ message: "Failed to update application status" });
  }
});

export default router;