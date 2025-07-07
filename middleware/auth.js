const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client
const supabase = createClient(
  process.env.BACKEND_SUPABASE_URL,
  process.env.BACKEND_SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// Verify Supabase session middleware
const verifySupabaseSession = async (req, res, next) => {
  try {
    // Extract token from Authorization header or cookies
    let token =
      req.headers.authorization?.split(" ")[1] ||
      req.cookies["sb-access-token"] ||
      req.cookies["sb:access_token"];

    console.log("Received token:", token ? `${token.substring(0, 10)}...` : "none"); // Log partial token for debugging

    if (!token) {
      console.error("No authentication token provided in request:", {
        url: req.url,
        headers: req.headers,
      });
      return res.status(401).json({
        success: false,
        error: "Access denied",
        message: "No authentication token provided",
      });
    }

    // Basic token format validation (JWT should have 3 segments: header.payload.signature)
    if (token.split(".").length !== 3) {
      console.error("Invalid token format:", {
        tokenPreview: `${token.substring(0, 20)}...`,
        segments: token.split("."),
        url: req.url,
      });
      return res.status(403).json({
        success: false,
        error: "Invalid token",
        message: "Token is malformed",
      });
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error("Supabase auth error:", {
        message: error?.message || "No error message",
        code: error?.code || "No code",
        url: req.url,
        tokenPreview: `${token.substring(0, 20)}...`,
      });
      return res.status(403).json({
        success: false,
        error: "Invalid session",
        message: error?.message || "Session is not valid or expired",
      });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role || user.role,
      ...user.user_metadata,
    };

    console.log("Authenticated user:", { id: user.id, email: user.email, role: req.user.role });

    next();
  } catch (error) {
    console.error("Session verification error:", {
      message: error.message,
      stack: error.stack,
      url: req.url,
    });
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to verify session",
    });
  }
};

// Check user role middleware
const checkRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
          message: "User not authenticated",
        });
      }

      const role = req.user.role || (await getUserRoleFromSupabase(req.user.id));

      if (!allowedRoles.includes(role)) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
          message: "You don't have permission to access this resource",
        });
      }

      next();
    } catch (error) {
      console.error("Role check error:", error);
      return res.status(500).json({
        success: false,
        error: "Authorization error",
        message: "Failed to check user permissions",
      });
    }
  };
};

// Helper function to get user role from Supabase
async function getUserRoleFromSupabase(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error("Failed to fetch user role");
  }

  return data.role;
}

module.exports = {
  verifyToken: verifySupabaseSession,
  checkRole,
};