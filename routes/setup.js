// backend/routes/setup.js
const express = require("express");
const { supabase } = require("../middleware/auth");

const router = express.Router();

router.post("/ensure-credits-column", async (req, res) => {
  try {
    // Add credits column if not exists
    const { error } = await supabase.rpc("execute_sql", {
      sql: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 10;`,
    });

    if (error) {
      console.error("Error adding credits column:", error);
      return res.status(500).json({ error: error.message });
    }

    // Set RLS policies for credits table
    const { error: rlsError } = await supabase.rpc("execute_sql", {
      sql: `
        ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Users can view their own credit records" ON credits;
        CREATE POLICY "Users can view their own credit records" ON credits FOR SELECT USING (auth.uid() = user_id);
        DROP POLICY IF EXISTS "Service role can do everything" ON credits;
        CREATE POLICY "Service role can do everything" ON credits USING (auth.role() = 'service_role');
        DROP POLICY IF EXISTS "Users can insert their own credit records" ON credits;
        CREATE POLICY "Users can insert their own credit records" ON credits FOR INSERT WITH CHECK (auth.uid() = user_id);
      `,
    });

    if (rlsError) {
      console.error("Error setting RLS policies:", rlsError);
      // Continue since this is non-critical
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Error in ensure-credits-column:", error);
    return res.status(500).json({ error: error.message });
  }
});



// Route: Setup Database
router.post("/setup-database", async (req, res) => {
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
      .select("role")
      .eq("id", authData.user.id)
      .single();

    if (profileError || profile.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Unauthorized",
        message: "Only admins can setup the database",
      });
    }

    // Create tables using RPC functions
    await supabase.rpc("create_profiles_if_not_exists");
    await supabase.rpc("create_credits_if_not_exists");
    await supabase.rpc("create_categories_if_not_exists");
    await supabase.rpc("create_leads_if_not_exists");

    res.status(200).json({
      success: true,
      message: "Database setup successfully",
    });
  } catch (error) {
    console.error("Setup database error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to setup database",
    });
  }
});

// Route: Create Stored Procedures
router.post("/create-stored-procedures", async (req, res) => {
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
      .select("role")
      .eq("id", authData.user.id)
      .single();

    if (profileError || profile.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Unauthorized",
        message: "Only admins can create stored procedures",
      });
    }

    // Create stored procedures
    await supabase.rpc("create_stored_procedures");

    res.status(200).json({
      success: true,
      message: "Stored procedures created successfully",
    });
  } catch (error) {
    console.error("Create stored procedures error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to create stored procedures",
    });
  }
});

module.exports = router;