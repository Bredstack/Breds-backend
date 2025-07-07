require("dotenv").config()

console.log("=== Environment Variables Check ===")
console.log("BACKEND_SUPABASE_URL:", process.env.BACKEND_SUPABASE_URL || "NOT SET")
console.log(
  "BACKEND_SUPABASE_SERVICE_ROLE_KEY:",
  process.env.BACKEND_SUPABASE_SERVICE_ROLE_KEY ? "SET (hidden)" : "NOT SET",
)
console.log("PORT:", process.env.PORT || "NOT SET")
console.log("FRONTEND_URL:", process.env.FRONTEND_URL || "NOT SET")
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "SET (hidden)" : "NOT SET")
console.log("NODE_ENV:", process.env.NODE_ENV || "NOT SET")

// Test Supabase connection
try {
  const { createClient } = require("@supabase/supabase-js")
  const supabase = createClient(process.env.BACKEND_SUPABASE_URL, process.env.BACKEND_SUPABASE_SERVICE_ROLE_KEY)
  console.log("✅ Supabase client created successfully")
} catch (error) {
  console.log("❌ Supabase client creation failed:", error.message)
}
