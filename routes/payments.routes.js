import express from "express";
import Stripe from "stripe";
import { getCollections } from "../config/db.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyAdmin } from "../middlewares/verifyRole.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const CLIENT_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

// Helper function to save payment & upgrade user plan (idempotent)
async function fulfillProUpgrade(session) {
  const { usersCollection, paymentsCollection } = await getCollections();

  const existingPayment = await paymentsCollection.findOne({
    stripeSessionId: session.id,
  });
  if (existingPayment) {
    return existingPayment;
  }

  const userEmail =
    session.metadata?.userEmail || session.customer_details?.email;
  const userName = session.metadata?.userName || "User";
  const userRole = session.metadata?.userRole || "student";
  const planName =
    session.metadata?.planName ||
    (userRole === "tutor" ? "Tutor Pro Plan" : "Student Pro Plan");

  const paymentRecord = {
    userEmail,
    userName,
    userRole,
    planName,
    amount: (session.amount_total || 0) / 100,
    currency: (session.currency || "usd").toUpperCase(),
    transactionId: session.payment_intent || session.id,
    stripeSessionId: session.id,
    paymentStatus: session.payment_status || "paid",
    paidAt: new Date(),
  };

  await paymentsCollection.insertOne(paymentRecord);

  if (userEmail) {
    await usersCollection.updateOne(
      { email: userEmail },
      {
        $set: {
          plan: "pro",
          upgradedAt: new Date(),
        },
      }
    );
  }

  return paymentRecord;
}

// 1. Create Stripe Checkout Session
router.post("/create-checkout-session", verifyToken, async (req, res) => {
  try {
    const { usersCollection } = await getCollections();
    const email = req.user.email;
    const dbUser = await usersCollection.findOne({ email });

    const role = dbUser?.role || req.user.role || "student";
    if (role === "admin") {
      return res
        .status(400)
        .json({ message: "Admin accounts do not require a Pro subscription" });
    }

    if (dbUser?.plan === "pro") {
      return res
        .status(400)
        .json({ message: "You are already subscribed to the Pro plan" });
    }

    const isTutor = role === "tutor";
    const unitAmount = isTutor ? 1500 : 1000; // $15.00 for Tutor, $10.00 for Student
    const planName = isTutor ? "Tutor Pro Plan" : "Student Pro Plan";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `MentorLagbe - ${planName}`,
              description: isTutor
                ? "Unlimited tuition posts and priority listing"
                : "Unlimited tuition applications and priority matching",
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userEmail: email,
        userName: dbUser?.name || req.user.name || "User",
        userRole: role,
        planName,
      },
      success_url: `${CLIENT_URL}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/dashboard/subscription`,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    res.status(500).json({ message: "Failed to create checkout session" });
  }
});

// 2. Stripe Webhook (must receive raw body in index.js)
export async function stripeWebhookHandler(req, res) {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_PUBLISHABLE_KEY
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.payment_status === "paid") {
      await fulfillProUpgrade(session);
    }
  }

  res.json({ received: true });
}

// 3. Confirm session from success page (backup for local testing without webhook CLI)
router.post("/confirm-session", verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ message: "Session ID is required" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment is not completed yet" });
    }

    const payment = await fulfillProUpgrade(session);
    res.json({
      message: "Pro subscription activated successfully",
      payment,
    });
  } catch (err) {
    console.error("Confirm session error:", err);
    res.status(500).json({ message: "Failed to verify payment session" });
  }
});

// 4. Get logged-in user's payment history
router.get("/my-payments", verifyToken, async (req, res) => {
  try {
    const { paymentsCollection } = await getCollections();
    const payments = await paymentsCollection
      .find({ userEmail: req.user.email })
      .sort({ paidAt: -1 })
      .toArray();

    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch payment history" });
  }
});

// 5. Admin: Get all payments & total revenue
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { paymentsCollection } = await getCollections();
    const payments = await paymentsCollection
      .find({})
      .sort({ paidAt: -1 })
      .toArray();

    const totalRevenue = payments.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );

    res.json({ payments, totalRevenue });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch all payments" });
  }
});

export default router;