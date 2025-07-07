// Test script to verify all route modules are loading correctly
require("dotenv").config()

console.log("Testing route modules...")

try {
  console.log("Testing auth routes...")
  const authRoutes = require("./routes/auth")
  console.log("✓ Auth routes loaded successfully")

  console.log("Testing leads routes...")
  const leadsRoutes = require("./routes/leads")
  console.log("✓ Leads routes loaded successfully")

  console.log("Testing applications routes...")
  const applicationsRoutes = require("./routes/applications")
  console.log("✓ Applications routes loaded successfully")

  console.log("Testing profile routes...")
  const profileRoutes = require("./routes/profile")
  console.log("✓ Profile routes loaded successfully")

  console.log("Testing middleware...")
  const { verifyToken, checkRole } = require("./middleware/auth")
  console.log("✓ Middleware loaded successfully")

  console.log("Testing Supabase config...")
  const supabase = require("./config/supabase")
  console.log("✓ Supabase config loaded successfully")

  console.log("\n✅ All modules loaded successfully!")
} catch (error) {
  console.error("❌ Error loading modules:", error)
  process.exit(1)
}
