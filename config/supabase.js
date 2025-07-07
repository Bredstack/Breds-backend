const { createClient } = require("@supabase/supabase-js")

// Debug environment variables
console.log("Environment check:")
console.log("BACKEND_SUPABASE_URL:", process.env.BACKEND_SUPABASE_URL ? "Set" : "Not set")
console.log("BACKEND_SUPABASE_SERVICE_ROLE_KEY:", process.env.BACKEND_SUPABASE_SERVICE_ROLE_KEY ? "Set" : "Not set")

// Validate required environment variables
if (!process.env.BACKEND_SUPABASE_URL) {
  console.error("Missing BACKEND_SUPABASE_URL environment variable")
  process.exit(1)
}

if (!process.env.BACKEND_SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing BACKEND_SUPABASE_SERVICE_ROLE_KEY environment variable")
  process.exit(1)
}

// Create Supabase client with service role key
const supabase = createClient(process.env.BACKEND_SUPABASE_URL, process.env.BACKEND_SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Test the connection
const testConnection = async () => {
  try {
    const { data, error } = await supabase.from("profiles").select("count").limit(1)
    if (error) {
      console.error("Supabase connection test failed:", error)
    } else {
      console.log("Supabase connection successful")
    }
  } catch (err) {
    console.error("Supabase connection error:", err)
  }
}

// Test connection on startup
testConnection()

module.exports = supabase
