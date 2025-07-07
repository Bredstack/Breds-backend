const express = require("express");
const supabase = require("../config/supabase");
const { verifyToken } = require("../middleware/auth");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


// Update credits after successful payment
router.post("/update", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { credits, paymentId, planName } = req.body;

    if (!credits || credits <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid credits",
        message: "Credit amount must be positive",
      });
    }

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: "Payment ID required",
        message: "Payment verification failed",
      });
    }

    // Get current credits
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to fetch user profile",
      });
    }

    const currentCredits = Number(profile?.credits) || 0;
    const newCredits = currentCredits + Number(credits);

    // Update user credits in profiles table
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ credits: newCredits })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating credits:", updateError);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to update credits",
      });
    }

    // Record the transaction in credits table
    const { error: transactionError } = await supabase.from("credits").insert([
      {
        user_id: userId,
        amount: credits,
        transaction_type: "purchase",
        description: `Purchased ${planName} plan`,
        payment_id: paymentId,
      },
    ]);

    if (transactionError) {
      console.error("Error recording transaction:", transactionError);
      // Don't fail the whole operation if transaction recording fails
    }

    res.status(200).json({
      success: true,
      message: "Credits updated successfully",
      previousBalance: currentCredits,
      newBalance: newCredits,
      added: credits,
    });
  } catch (error) {
    console.error("Error in update credits:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to update credits",
    });
  }
});

// Get user's credit balance
router.get("/balance", verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching credits:", error);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to fetch credit balance",
      });
    }

    res.status(200).json({
      success: true,
      credits: Number(profile?.credits) || 0,
    });
  } catch (error) {
    console.error("Error in get credits balance:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to fetch credit balance",
    });
  }
});

// Get credit history
router.get("/history", verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;

    const { data: transactions, error } = await supabase
      .from("credits")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching credit history:", error);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to fetch credit history",
      });
    }

    res.status(200).json({
      success: true,
      transactions: transactions || [],
    });
  } catch (error) {
    console.error("Error in get credit history:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to fetch credit history",
    });
  }
});

// Add credits to user (admin or alternative method)
router.post("/add", verifyToken, async (req, res) => {
  try {
    const { amount, paymentId, description } = req.body;
    const { userId } = req.user;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid amount",
        message: "Credit amount must be positive",
      });
    }

    // Get current credits
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to fetch user profile",
      });
    }

    const currentCredits = Number(profile?.credits) || 0;
    const newCredits = currentCredits + Number(amount);

    // Update user credits
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ credits: newCredits })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating credits:", updateError);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to update credits",
      });
    }

    // Record the transaction
    const { error: transactionError } = await supabase.from("credits").insert([
      {
        user_id: userId,
        amount,
        transaction_type: "purchase",
        description: description || "Credit purchase",
        payment_id: paymentId,
      },
    ]);

    if (transactionError) {
      console.error("Error recording transaction:", transactionError);
    }

    res.status(200).json({
      success: true,
      message: "Credits added successfully",
      previousBalance: currentCredits,
      newBalance: newCredits,
      added: amount,
    });
  } catch (error) {
    console.error("Error in add credits:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to add credits",
    });
  }
});

module.exports = router;