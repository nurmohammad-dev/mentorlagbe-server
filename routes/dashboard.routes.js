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
        tuitionsCollection.countDocuments({
          $or: [{ approvalStatus: "pending" }, { status: "pending" }],
        }),
        tuitionsCollection.countDocuments({
          $or: [{ approvalStatus: "approved" }, { status: "approved" }],
        }),
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
        (t) => (t.approvalStatus || t.status) === "approved"
      ).length;
      const pendingTuitionCount = myTuitions.filter(
        (t) => (t.approvalStatus || t.status) === "pending"
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

// 2. Admin: Seed 12 initial sample tuitions
router.post("/seed", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { tuitionsCollection } = await getCollections();

    const sampleTuitions = [
      {
        title: "HSC Physics & Higher Math Concept Batch",
        subject: "Physics",
        classLevel: "HSC",
        mode: "Offline",
        location: "Dhanmondi, Dhaka",
        daysPerWeek: "3 days/week",
        monthlyFee: 6000,
        description:
          "In-depth HSC Physics problem solving with weekly CQ & MCQ board standard exams.",
        bannerImage:
          "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=900&q=80",
        tutorName: "Tanvir Ahmed",
        tutorEmail: "tanvir.tutor@mentorlagbe.com",
        approvalStatus: "approved",
        isActive: true,
        createdAt: new Date(),
      },
      {
        title: "SSC General & Higher Mathematics Mentorship",
        subject: "Mathematics",
        classLevel: "SSC",
        mode: "Offline",
        location: "Uttara, Dhaka",
        daysPerWeek: "4 days/week",
        monthlyFee: 5000,
        description:
          "Step-by-step algebra, geometry, and trigonometry mastery for SSC candidates.",
        bannerImage:
          "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=900&q=80",
        tutorName: "Nusrat Jahan",
        tutorEmail: "nusrat.tutor@mentorlagbe.com",
        approvalStatus: "approved",
        isActive: true,
        createdAt: new Date(),
      },
      {
        title: "IELTS Academic Writing & Speaking Intensive",
        subject: "IELTS",
        classLevel: "All Levels",
        mode: "Online",
        location: "Online (Zoom)",
        daysPerWeek: "3 days/week",
        monthlyFee: 6500,
        description:
          "Personalized Task 1 & Task 2 essay evaluations plus 1-on-1 speaking mock tests.",
        bannerImage:
          "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=900&q=80",
        tutorName: "Rafiqul Islam",
        tutorEmail: "rafiq.tutor@mentorlagbe.com",
        approvalStatus: "approved",
        isActive: true,
        createdAt: new Date(),
      },
      {
        title: "HSC Chemistry 1st & 2nd Paper Special Care",
        subject: "Chemistry",
        classLevel: "HSC",
        mode: "Offline",
        location: "Mirpur, Dhaka",
        daysPerWeek: "3 days/week",
        monthlyFee: 5500,
        description:
          "Organic reaction mechanisms and quantitative chemistry explained with clarity.",
        bannerImage:
          "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=900&q=80",
        tutorName: "Sadia Rahman",
        tutorEmail: "sadia.tutor@mentorlagbe.com",
        approvalStatus: "approved",
        isActive: true,
        createdAt: new Date(),
      },
      {
        title: "O-Level English Language & Literature Coaching",
        subject: "English",
        classLevel: "O-Level",
        mode: "Online",
        location: "Online (Google Meet)",
        daysPerWeek: "2 days/week",
        monthlyFee: 5500,
        description:
          "Cambridge syllabus comprehension, directed writing, and grammar precision.",
        bannerImage:
          "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=900&q=80",
        tutorName: "Farhana Akter",
        tutorEmail: "farhana.tutor@mentorlagbe.com",
        approvalStatus: "approved",
        isActive: true,
        createdAt: new Date(),
      },
      {
        title: "HSC ICT C-Programming & SQL Practical Batch",
        subject: "ICT",
        classLevel: "HSC",
        mode: "Online",
        location: "Online (Zoom)",
        daysPerWeek: "3 days/week",
        monthlyFee: 3500,
        description:
          "Hands-on C coding, HTML web design, number systems, and database queries.",
        bannerImage:
          "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=900&q=80",
        tutorName: "Mahmudul Hasan",
        tutorEmail: "mahmud.tutor@mentorlagbe.com",
        approvalStatus: "approved",
        isActive: true,
        createdAt: new Date(),
      },
      {
        title: "Class 9–10 General Science & Biology Foundation",
        subject: "Biology",
        classLevel: "SSC",
        mode: "Offline",
        location: "Mohammadpur, Dhaka",
        daysPerWeek: "3 days/week",
        monthlyFee: 4500,
        description:
          "Diagram-based biology learning and conceptual clarity for secondary students.",
        bannerImage:
          "https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=900&q=80",
        tutorName: "Dr. Ayesha Siddiqua",
        tutorEmail: "ayesha.tutor@mentorlagbe.com",
        approvalStatus: "approved",
        isActive: true,
        createdAt: new Date(),
      },
      {
        title: "A-Level Pure Mathematics & Mechanics",
        subject: "Mathematics",
        classLevel: "A-Level",
        mode: "Online",
        location: "Online (Zoom)",
        daysPerWeek: "3 days/week",
        monthlyFee: 8000,
        description:
          "Edexcel & Cambridge past paper drills for P1, P2, P3, and M1 modules.",
        bannerImage:
          "https://images.unsplash.com/photo-1596495578065-6e0763fa1178?auto=format&fit=crop&w=900&q=80",
        tutorName: "Tariqul Alam",
        tutorEmail: "tariq.tutor@mentorlagbe.com",
        approvalStatus: "approved",
        isActive: true,
        createdAt: new Date(),
      },
      {
        title: "Spoken English & Presentation Skills for Students",
        subject: "English",
        classLevel: "All Levels",
        mode: "Online",
        location: "Online (Google Meet)",
        daysPerWeek: "2 days/week",
        monthlyFee: 3000,
        description:
          "Interactive speaking drills, pronunciation refinement, and public speaking confidence.",
        bannerImage:
          "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
        tutorName: "Maliha Chowdhury",
        tutorEmail: "maliha.tutor@mentorlagbe.com",
        approvalStatus: "approved",
        isActive: true,
        createdAt: new Date(),
      },
      {
        title: "Class 8 Mathematics & English Core Care",
        subject: "Mathematics",
        classLevel: "Class 8",
        mode: "Offline",
        location: "Banani, Dhaka",
        daysPerWeek: "4 days/week",
        monthlyFee: 5000,
        description:
          "Strong academic habits, weekly progress feedback, and school exam readiness.",
        bannerImage:
          "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=900&q=80",
        tutorName: "Rakin Hasan",
        tutorEmail: "rakin.tutor@mentorlagbe.com",
        approvalStatus: "approved",
        isActive: true,
        createdAt: new Date(),
      },
      {
        title: "HSC Accounting & Finance Board Preparation",
        subject: "Accounting",
        classLevel: "HSC",
        mode: "Offline",
        location: "Bashundhara R/A, Dhaka",
        daysPerWeek: "3 days/week",
        monthlyFee: 4500,
        description:
          "Financial statements, ledger balancing, and business math made simple.",
        bannerImage:
          "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=80",
        tutorName: "Kamrul Islam",
        tutorEmail: "kamrul.tutor@mentorlagbe.com",
        approvalStatus: "approved",
        isActive: true,
        createdAt: new Date(),
      },
      {
        title: "Python Programming & Problem Solving for Beginners",
        subject: "Programming",
        classLevel: "All Levels",
        mode: "Online",
        location: "Online (Zoom)",
        daysPerWeek: "2 days/week",
        monthlyFee: 4000,
        description:
          "Learn Python fundamentals, logic building, and mini-projects from scratch.",
        bannerImage:
          "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=900&q=80",
        tutorName: "Zarif Hossain",
        tutorEmail: "zarif.tutor@mentorlagbe.com",
        approvalStatus: "approved",
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