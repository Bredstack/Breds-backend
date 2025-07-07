const express = require("express")
const supabase = require("../config/supabase")
const { verifyToken } = require("../middleware/auth")

const router = express.Router()

// Get user profile
router.get("/", verifyToken, async (req, res) => {
  try {
    const { userId } = req.user

    const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", userId).single()

    if (error) {
      return res.status(404).json({
        success: false,
        error: "Profile not found",
        message: "User profile not found",
      })
    }

    res.status(200).json({
      success: true,
      profile: {
        id: profile.id,
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
        username: profile.username,
        role: profile.role,
        credits: profile.credits,
        profileComplete: profile.profile_complete,
        bio: profile.bio,
        avatarUrl: profile.avatar_url,
        phoneNumber: profile.phone_number,
        address: profile.address,
        company: profile.company,
        position: profile.position,
        yearsOfExperience: profile.years_of_experience,
        registrationStep: profile.registration_step,
      },
    })
  } catch (error) {
    console.error("Error fetching profile:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to fetch user profile",
    })
  }
})

// Update user profile
router.put("/", verifyToken, async (req, res) => {
  try {
    const { userId } = req.user
    const {
      firstName,
      lastName,
      username,
      bio,
      avatarUrl,
      phoneNumber,
      address,
      company,
      position,
      yearsOfExperience,
      profileComplete,
    } = req.body

    // Prepare update object
    const updates = {}
    if (firstName !== undefined) updates.first_name = firstName
    if (lastName !== undefined) updates.last_name = lastName
    if (username !== undefined) updates.username = username
    if (bio !== undefined) updates.bio = bio
    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl
    if (phoneNumber !== undefined) updates.phone_number = phoneNumber
    if (address !== undefined) updates.address = address
    if (company !== undefined) updates.company = company
    if (position !== undefined) updates.position = position
    if (yearsOfExperience !== undefined) updates.years_of_experience = yearsOfExperience
    if (profileComplete !== undefined) updates.profile_complete = profileComplete

    // Add updated_at timestamp
    updates.updated_at = new Date().toISOString()

    // Update profile
    const { data: updatedProfile, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single()

    if (error) {
      console.error("Error updating profile:", error)
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to update profile",
      })
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      profile: {
        id: updatedProfile.id,
        email: updatedProfile.email,
        firstName: updatedProfile.first_name,
        lastName: updatedProfile.last_name,
        username: updatedProfile.username,
        role: updatedProfile.role,
        credits: updatedProfile.credits,
        profileComplete: updatedProfile.profile_complete,
        bio: updatedProfile.bio,
        avatarUrl: updatedProfile.avatar_url,
        phoneNumber: updatedProfile.phone_number,
        address: updatedProfile.address,
        company: updatedProfile.company,
        position: updatedProfile.position,
        yearsOfExperience: updatedProfile.years_of_experience,
        registrationStep: updatedProfile.registration_step,
      },
    })
  } catch (error) {
    console.error("Error updating profile:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to update profile",
    })
  }
})

// Get credits balance
router.get("/credits", verifyToken, async (req, res) => {
  try {
    const { userId } = req.user

    const { data: profile, error } = await supabase.from("profiles").select("credits").eq("id", userId).single()

    if (error) {
      return res.status(404).json({
        success: false,
        error: "Profile not found",
        message: "User profile not found",
      })
    }

    res.status(200).json({
      success: true,
      credits: profile.credits,
    })
  } catch (error) {
    console.error("Error fetching credits:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to fetch credits balance",
    })
  }
})

// Get credit history
router.get("/credits/history", verifyToken, async (req, res) => {
  try {
    const { userId } = req.user

    const { data: transactions, error } = await supabase
      .from("credits")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching credit history:", error)
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to fetch credit history",
      })
    }

    res.status(200).json({
      success: true,
      transactions: transactions || [],
    })
  } catch (error) {
    console.error("Error fetching credit history:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to fetch credit history",
    })
  }
})

module.exports = router
