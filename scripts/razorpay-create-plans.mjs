/**
 * Create Razorpay subscription Plans for Writer (₹199) and Studio (₹599).
 * Run in TEST mode only:
 *   node --env-file=.env scripts/razorpay-create-plans.mjs
 *
 * Prints plan_ids to paste into .env as RAZORPAY_PLAN_WRITER_ID / STUDIO_ID.
 * Does not print key secrets.
 */
import Razorpay from "razorpay";

const key_id = process.env.RAZORPAY_KEY_ID?.trim();
const key_secret = process.env.RAZORPAY_KEY_SECRET?.trim();

if (!key_id || !key_secret) {
  console.error("Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env first.");
  process.exit(1);
}

if (!key_id.startsWith("rzp_test_")) {
  console.error("Refusing to create plans: key is not rzp_test_ (test mode).");
  process.exit(1);
}

const razorpay = new Razorpay({ key_id, key_secret });

const writer = await razorpay.plans.create({
  period: "monthly",
  interval: 1,
  item: {
    name: "AFTIONIX Writer",
    amount: 19900, // paise
    currency: "INR",
    description: "Writer plan — monthly",
  },
});

const studio = await razorpay.plans.create({
  period: "monthly",
  interval: 1,
  item: {
    name: "AFTIONIX Studio",
    amount: 59900,
    currency: "INR",
    description: "Studio plan — monthly",
  },
});

console.log("Add these to .env (test mode):");
console.log(`RAZORPAY_PLAN_WRITER_ID=${writer.id}`);
console.log(`RAZORPAY_PLAN_STUDIO_ID=${studio.id}`);
