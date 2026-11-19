import express from "express";
import { getCollections } from "../config/db.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyAdmin } from "../middlewares/verifyRole.js";

const router = express.Router();

// 1. Role-based Dashboard Overview Stats & Chart Data
router.get("/stats", verifyToken, async (req, res) => {
  try {
    const {
      usersCollection,
      tuitionsCollection,
      applicationsCollection,
      paymentsCollection,
    } = await getCollections();

    const email = req.user.email;
    const dbUser = await usersCollection.findOne({ email });
    const role = dbUser?.role || req.user.role || "student";

    // Admin Overview Stats
    if (role === "admin") {
      const [
        totalUsers,
        totalStudents,
        totalTutors,
        totalTuitions,
        pendingTuitions,
        approvedTuitions,
        totalApplications,
        payments,
        subjectStats,
      ] = await Promise.all([
        usersCollection.countDocuments({}),
        usersCollection.countDocuments({ role: "student" }),
        usersCollection.countDocuments({ role: "tutor" }),
        tuitionsCollection.countDocuments({}),
        tuitionsCollection.countDocuments({ status: "pending" }),
        tuitionsCollection.countDocuments({ status: "approved" }),
        applicationsCollection.countDocuments({}),
        paymentsCollection.find({}).toArray(),
        tuitionsCollection
          .aggregate([
            { $group: { _id: "$subject", count: { $sum: 1 } } },
            { $project: { subject: "$_id", count: 1, _id: 0 } },
          ])
          .toArray(),
      ]);

      const totalRevenue = payments.reduce(
        (sum, item) => sum + (Number(item.amount) || 0),
        0
      );

      return res.json({
        role: "admin",
        stats: {
          totalUsers,
          totalStudents,
          totalTutors,
          totalTuitions,
          pendingTuitions,
          approvedTuitions,
          totalApplications,
          totalRevenue,
        },
        chartData: subjectStats,
      });
    }

    // Tutor Overview Stats
    if (role === "tutor") {
      const [myTuitions, myApplications] = await Promise.all([
        tuitionsCollection.find({ tutorEmail: email }).toArray(),
        applicationsCollection.find({ tutorEmail: email }).toArray(),
      ]);

      const approvedCount = myTuitions.filter(
        (t) => t.status === "approved"
      ).length;
      const pendingTuitionCount = myTuitions.filter(
        (t) => t.status === "pending"
      ).length;
      const acceptedApps = myApplications.filter(
        (a) => a.status === "accepted"
      ).length;
      const pendingApps = myApplications.filter(
        (a) => a.status === "pending"
      ).length;
      const rejectedApps = myApplications.filter(
        (a) => a.status === "rejected"
      ).length;

      return res.json({
        role: "tutor",
        plan: dbUser?.plan || "free",
        stats: {
          totalTuitions: myTuitions.length,
          approvedTuitions: approvedCount,
          pendingTuitions: pendingTuitionCount,
          totalApplications: myApplications.length,
          acceptedApplications: acceptedApps,
          pendingApplications: pendingApps,
        },
        chartData: [
          { name: "Pending", value: pendingApps },
          { name: "Accepted", value: acceptedApps },
          { name: "Rejected", value: rejectedApps },
        ],
      });
    }

    // Student Overview Stats
    const myApplications = await applicationsCollection
      .find({ studentEmail: email })
      .toArray();

    const acceptedCount = myApplications.filter(
      (a) => a.status === "accepted"
    ).length;
    const pendingCount = myApplications.filter(
      (a) => a.status === "pending"
    ).length;
    const rejectedCount = myApplications.filter(
      (a) => a.status === "rejected"
    ).length;

    return res.json({
      role: "student",
      plan: dbUser?.plan || "free",
      stats: {
        totalApplications: myApplications.length,
        acceptedApplications: acceptedCount,
        pendingApplications: pendingCount,
        rejectedApplications: rejectedCount,
      },
      chartData: [
        { name: "Pending", value: pendingCount },
        { name: "Accepted", value: acceptedCount },
        { name: "Rejected", value: rejectedCount },
      ],
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load dashboard statistics" });
  }
});

// 2. Admin: Seed initial sample tuitions for quick testing
router.post("/seed", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { tuitionsCollection } = await getCollections();

    const sampleTuitions = [
      {
        title: "HSC Physics & Higher Math Special Batch",
        subject: "Physics",
        classLevel: "HSC",
        mode: "Offline",
        location: "Dhanmondi, Dhaka",
        schedule: "Sat, Mon, Wed (5:00 PM - 6:30 PM)",
        monthlyFee: 6000,
        totalSeats: 4,
        description:
          "Concept-focused HSC Physics preparation with weekly CQ and MCQ model tests.",
        tutorName: "Tanvir Ahmed",
        tutorEmail: "tanvir.tutor@mentorlagbe.com",
        status: "approved",
        isActive: true,
        createdAt: new Date(),
      },
      {
        title: "SSC General & Higher Mathematics Mentorship",
        subject: "Mathematics",
        classLevel: "SSC",
        mode: "Offline",
        location: "Uttara, Dhaka",
        schedule: "Sun, Tue, Thu (4:30 PM - 6:00 PM)",
        monthlyFee: 5000,
        totalSeats: 3,
        description:
          "Step-by-step problem solving and board question analysis for SSC candidates.",
        tutorName: "Nusrat Jahan",
        tutorEmail: "nusrat.tutor@mentorlagbe.com",
        status: "approved",
        isActive: true,
        createdAt: new Date(),
      },
      {
        title: "O-Level English Language & Literature Coaching",
        subject: "English",
        classLevel: "O-Level",
        mode: "Online",
        location: "Online (Zoom)",
        schedule: "Fri, Sat (7:00 PM - 8:30 PM)",
        monthlyFee: 5500,
        totalSeats: 5,
        description:
          "Cambridge O-Level essay writing, comprehension, and spoken fluency sessions.",
        tutorName: "Rafiqul Islam",
        tutorEmail: "rafiq.tutor@mentorlagbe.com",
        status: "approved",
        isActive: true,
        createdAt: new Date(),
      },
      {
        title: "HSC Chemistry 1st & 2nd Paper Intensive",
        subject: "Chemistry",
        classLevel: "HSC",
        mode: "Hybrid",
        location: "Mirpur, Dhaka",
        schedule: "Mon, Wed, Fri (6:00 PM - 7:30 PM)",
        monthlyFee: 5500,
        totalSeats: 4,
        description:
          "Organic chemistry reaction mechanisms and quantitative chemistry mastery.",
        tutorName: "Sadia Rahman",
        tutorEmail: "sadia.tutor@mentorlagbe.com",
        status: "approved",
        isActive: true,
        createdAt: new Date(),
      },
      {
        title: "Class 8 All Subjects Foundation Care",
        subject: "Science",
        classLevel: "Class 8",
        mode: "Offline",
        location: "Mohammadpur, Dhaka",
        schedule: "Sat, Mon, Wed (4:00 PM - 5:30 PM)",
        monthlyFee: 4000,
        totalSeats: 2,
        description:
          "Strong foundation building in Science, Mathematics, and English grammar.",
        tutorName: "Mahmudul Hasan",
        tutorEmail: "mahmud.tutor@mentorlagbe.com",
        status: "approved",
        isActive: true,
        createdAt: new Date(),
      },
      {
        title: "HSC ICT Programming & Database Practical",
        subject: "ICT",
        classLevel: "HSC",
        mode: "Online",
        location: "Online (Google Meet)",
        schedule: "Tue, Thu (8:00 PM - 9:30 PM)",
        monthlyFee: 3500,
        totalSeats: 6,
        description:
          "Hands-on C programming, HTML, SQL database, and number system tutorials.",
        tutorName: "Farhana Akter",
        tutorEmail: "farhana.tutor@mentorlagbe.com",
        status: "approved",
        isActive: true,
        createdAt: new Date(),
      },
    ];

    const result = await tuitionsCollection.insertMany(sampleTuitions);
    res.status(201).json({
      message: `${result.insertedCount} sample tuitions seeded successfully`,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to seed sample tuitions" });
  }
});

export default router;