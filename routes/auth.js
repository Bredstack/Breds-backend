const express = require("express");
const supabase = require("../config/supabase");
const crypto = require("crypto");

const router = express.Router();

// Sign Up Route
router.post("/signup", async (req, res) => {
  try {
    const { email, password, firstName, lastName, username, role } = req.body;

    if (!email || !password || !firstName || !lastName || !username || !role) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "Email, password, firstName, lastName, username, and role are required",
      });
    }

    if (!["lead-finder", "lead-applier"].includes(role)) {
      return res.status(400).json({
        success: false,
        error: "Invalid role",
        message: 'Role must be either "lead-finder" or "lead-applier"',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Weak password",
        message: "Password must be at least 8 characters long",
      });
    }

    const { data: existingUsers, error: existingError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (existingUsers) {
      return res.status(409).json({
        success: false,
        error: "User already exists",
        message: "A user with this email already exists",
      });
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          username,
          role,
        },
      },
    });

    if (authError) {
      console.error("Supabase auth error:", authError);
      return res.status(400).json({
        success: false,
        error: "Authentication error",
        message: authError.message,
      });
    }

    const { error: profileError } = await supabase.from("profiles").insert([
      {
        id: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        username,
        role,
        registration_step: 1,
        profile_complete: false,
        credits: 10,
      },
    ]);

    if (profileError) {
      console.error("Profile creation error:", profileError);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({
        success: false,
        error: "Profile creation failed",
        message: "Failed to create user profile",
      });
    }

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        id: authData.user.id,
        email: authData.user.email,
        firstName,
        lastName,
        username,
        role,
      },
      session: authData.session,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to create user account",
    });
  }
});

// Sign In Route
router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Missing credentials",
        message: "Email and password are required",
      });
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error("Supabase signin error:", authError);
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
        message: "Invalid email or password",
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      return res.status(500).json({
        success: false,
        error: "Profile fetch failed",
        message: "Failed to retrieve user profile",
      });
    }

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: authData.user.id,
        email: authData.user.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
        username: profile.username,
        role: profile.role,
        credits: profile.credits,
      },
      session: authData.session,
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to sign in",
    });
  }
});

// Sign Out Route
router.post("/signout", async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: "Signed out successfully",
    });
  } catch (error) {
    console.error("Signout error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to sign out",
    });
  }
});

// Get Current User Route
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader && authHeader.split(" ")[1];

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: "No token provided",
        message: "Authorization token is required",
      });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !authData.user) {
      return res.status(401).json({
        success: false,
        error: "Invalid token",
        message: "Token is invalid",
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    if (profileError) {
      return res.status(404).json({
        success: false,
        error: "User not found",
        message: "User profile not found",
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
        username: profile.username,
        role: profile.role,
        credits: profile.credits,
        profileComplete: profile.profile_complete,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to get user information",
    });
  }
});

// New Route: Create Profile
router.post("/create-profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader && authHeader.split(" ")[1];

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: "No token provided",
        message: "Authorization token is required",
      });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return res.status(401).json({
        success: false,
        error: "Invalid token",
        message: "Token is invalid",
      });
    }

    const { userId, email, firstName, lastName, username, role } = req.body;

    if (!userId || !email || !firstName || !lastName || !username || !role) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "userId, email, firstName, lastName, username, and role are required",
      });
    }

    if (userId !== authData.user.id) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized",
        message: "User ID does not match authenticated user",
      });
    }

    if (!["lead-finder", "lead-applier"].includes(role)) {
      return res.status(400).json({
        success: false,
        error: "Invalid role",
        message: 'Role must be either "lead-finder" or "lead-applier"',
      });
    }

    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId);

    if (existingProfile && existingProfile.length > 0) {
      return res.status(200).json({
        success: true,
        profile: existingProfile[0],
      });
    }

    const profileData = {
      id: userId,
      email,
      first_name: firstName,
      last_name: lastName,
      username,
      role,
      registration_step: 1,
      profile_complete: false,
      credits: 10,
    };

    const { data, error } = await supabase.from("profiles").insert([profileData]).select();

    if (error) {
      console.error("Error creating profile:", error);
      return res.status(500).json({
        success: false,
        error: "Profile creation failed",
        message: error.message,
      });
    }

    try {
      await supabase.from("credits").insert([
        {
          user_id: userId,
          amount: 10,
          transaction_type: "signup_bonus",
          description: "Welcome bonus",
        },
      ]);
    } catch (e) {
      console.error("Error adding initial credits:", e);
    }

    res.status(201).json({
      success: true,
      profile: data[0],
    });
  } catch (error) {
    console.error("Create profile error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to create profile",
    });
  }
});

// New Route: Complete User Profile
router.post("/complete-profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader && authHeader.split(" ")[1];

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: "No token provided",
        message: "Authorization token is required",
      });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return res.status(401).json({
        success: false,
        error: "Invalid token",
        message: "Token is invalid",
      });
    }

    const { userId, profileData } = req.body;

    if (!userId || !profileData) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "userId and profileData are required",
      });
    }

    if (userId !== authData.user.id) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized",
        message: "User ID does not match authenticated user",
      });
    }

    const { error } = await supabase.from("profiles").update(profileData).eq("id", userId);

    if (error) {
      console.error("Error completing profile:", error);
      return res.status(500).json({
        success: false,
        error: "Profile update failed",
        message: error.message,
      });
    }

    try {
      await supabase.from("credits").insert([
        {
          user_id: userId,
          amount: 15,
          transaction_type: "profile_completion",
          description: "Profile completion bonus",
        },
      ]);
    } catch (e) {
      console.error("Error adding profile completion credits:", e);
    }

    res.status(200).json({
      success: true,
      message: "Profile completed successfully",
    });
  } catch (error) {
    console.error("Complete profile error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to complete profile",
    });
  }
});


// // New Route: Add Dummy Data
// router.post("/add-dummy-data", async (req, res) => {
//   try {
//     const authHeader = req.headers.authorization;
//     const accessToken = authHeader && authHeader.split(" ")[1];

//     if (!accessToken) {
//       return res.status(401).json({
//         success: false,
//         error: "No token provided",
//         message: "Authorization token is required",
//       });
//     }

//     const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
//     if (authError || !authData.user) {
//       return res.status(401).json({
//         success: false,
//         error: "Invalid token",
//         message: "Token is invalid",
//       });
//     }

//     const { data: profile, error: profileError } = await supabase
//       .from("profiles")
//       .select("role")
//       .eq("id", authData.user.id)
//       .single();

//     if (profileError || profile.role !== "admin") {
//       return res.status(403).json({
//         success: false,
//         error: "Unauthorized",
//         message: "Only admins can add dummy data",
//       });
//     }

//     try {
//       const { error: tableCheckError } = await supabase.from("categories").select("count").limit(1);

//       if (!tableCheckError) {
//         const categories = [
//           {
//             name: "Web Development",
//             description: "Web application development services",
//             icon: "code",
//             color: "#4f46e5",
//           },
//           {
//             name: "Mobile Development",
//             description: "Mobile app development services",
//             icon: "smartphone",
//             color: "#0ea5e9",
//           },
//           {
//             name: "UI/UX Design",
//             description: "User interface and experience design",
//             icon: "palette",
//             color: "#ec4899",
//           },
//           {
//             name: "Digital Marketing",
//             description: "Online marketing and SEO services",
//             icon: "trending-up",
//             color: "#10b981",
//           },
//           { name: "Content Writing", description: "Professional content creation", icon: "edit-3", color: "#f59e0b" },
//         ];

//         for (const category of categories) {
//           await supabase.from("categories").insert([category]).catch((e) => console.error("Error adding category:", e));
//         }
//       }
//     } catch (e) {
//       console.error("Error with categories:", e);
//     }

//     try {
//       const { error: leadsTableCheckError } = await supabase.from("leads").select("count").limit(1);

//       if (!leadsTableCheckError) {
//         const leads = [
//           {
//             title: "E-commerce Website Development",
//             description: "Looking for an experienced developer to build a custom e-commerce platform.",
//             category: "Web Development",
//             credit_cost: 5,
//             status: "active",
//             created_by: authData.user.id,
//             expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
//           },
//           {
//             title: "Mobile App for Fitness Tracking",
//             description: "Need a developer to create a fitness tracking app for iOS and Android.",
//             category: "Mobile Development",
//             credit_cost: 8,
//             status: "active",
//             created_by: authData.user.id,
//             expires_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
//           },
//         ];

//         for (const lead of leads) {
//           await supabase.from("leads").insert([lead]).catch((e) => console.error("Error adding lead:", e));
//         }
//       }
//     } catch (e) {
//       console.error("Error with leads:", e);
//     }

//     res.status(200).json({
//       success: true,
//       message: "Dummy data added successfully",
//     });
//   } catch (error) {
//     console.error("Add dummy data error:", error);
//     res.status(500).json({
//       success: true, // Match frontend behavior of returning success
//       message: "Failed to add dummy data",
//     });
//   }
// });




// Razorpay Payment Verification (from previous response)
router.post("/razorpay-verify", async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "razorpay_payment_id, razorpay_order_id, and razorpay_signature are required",
      });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature === razorpay_signature) {
      const { error: updateError } = await supabase
        .from("payments")
        .update({ status: "verified", payment_id: razorpay_payment_id })
        .eq("order_id", razorpay_order_id);

      if (updateError) {
        console.error("Payment update error:", updateError);
        return res.status(500).json({
          success: false,
          error: "Database update failed",
          message: updateError.message,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment verified successfully",
      });
    } else {
      return res.status(400).json({
        success: false,
        error: "Invalid signature",
        message: "Payment verification failed",
      });
    }
  } catch (error) {
    console.error("Razorpay verification error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to verify payment",
    });
  }
});

module.exports = router;