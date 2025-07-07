// backend/routes/users.js
const express = require("express");
const supabase = require("../config/supabase");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Get user profile by ID
router.get("/:uid/profile", verifyToken, async (req, res) => {
  try {
    const { uid } = req.params;
    const { id: requesterId } = req.user;

    console.log("Fetching profile for user:", { uid, requesterId });

    if (!uid) {
      return res.status(400).json({
        success: false,
        error: "Missing user ID",
      });
    }

    // Fetch profile from Supabase
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email, username, first_name, last_name, phone_number, company, bio, avatar_url")
      .eq("id", uid)
      .maybeSingle(); // Use maybeSingle instead of single

    if (error) {
      console.error("Error fetching profile:", error);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: error.message,
      });
    }

    if (!profile) {
      console.warn("No profile found for user ID:", uid);
      return res.status(404).json({
        success: false,
        error: "Profile not found",
        message: "No profile exists for this user",
      });
    }

    res.status(200).json({
      success: true,
      profile: {
        id: profile.id,
        email: profile.email,
        username: profile.username,
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone_number: profile.phone_number,
        company: profile.company,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
      },
    });
  } catch (error) {
    console.error("Error in get profile:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message || "Failed to fetch profile",
    });
  }
});

module.exports = router;