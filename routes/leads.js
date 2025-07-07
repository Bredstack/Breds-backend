const express = require("express")
const supabase = require("../config/supabase")
const { verifyToken, checkRole } = require("../middleware/auth")

const router = express.Router()

// Get public leads (no auth required)
router.get("/browse", async (req, res) => {
  try {
    // Get query parameters for filtering
    const { category, location, search, limit = 20, offset = 0 } = req.query

    // Start building the query
    let query = supabase
      .from("leads")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .range(Number.parseInt(offset), Number.parseInt(offset) + Number.parseInt(limit) - 1)

    // Apply filters if provided
    if (category) {
      query = query.eq("category", category)
    }

    if (location) {
      query = query.eq("location", location)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // Execute the query
    const { data: leads, error } = await query

    if (error) {
      console.error("Error fetching leads:", error)
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to fetch leads",
      })
    }

    res.status(200).json({
      success: true,
      leads: leads || [],
      count: leads?.length || 0,
    })
  } catch (error) {
    console.error("Error in browse leads:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to fetch leads",
    })
  }
})

// Get a single lead by ID (public)
router.get("/browse/:id", async (req, res) => {
  try {
    const { id } = req.params

    const { data: lead, error } = await supabase.from("leads").select("*").eq("id", id).single()

    if (error) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
        message: "The requested lead does not exist",
      })
    }

    res.status(200).json({
      success: true,
      lead,
    })
  } catch (error) {
    console.error("Error fetching lead:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to fetch lead details",
    })
  }
})

// Get all leads (authenticated)
router.get("/", verifyToken, async (req, res) => {
  try {
    const { role } = req.user;
    let query;

    if (role === "lead-applier") {
      query = supabase
        .from("leads")
        .select("*, profiles(first_name, last_name)")
        .eq("created_by", req.user.userId)
        .order("created_at", { ascending: false });
    } else {
      query = supabase
        .from("leads")
        .select("*, profiles(first_name, last_name)")
        .eq("status", "active")
        .order("created_at", { ascending: false });
    }

    const { data: leads, error } = await query;

    if (error) {
      console.error("Error fetching leads:", error);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to fetch leads",
      });
    }

    res.status(200).json({
      success: true,
      leads: leads || [],
    });
  } catch (error) {
    console.error("Error in get leads:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to fetch leads",
    });
  }
});

// Get a single lead by ID (authenticated)
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const { userId, role } = req.user

    // Get the lead
    const { data: lead, error } = await supabase.from("leads").select("*").eq("id", id).single()

    if (error) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
        message: "The requested lead does not exist",
      })
    }

    // Check if user has access to this lead
    if (role === "lead-applier" && lead.created_by !== userId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
        message: "You don't have permission to view this lead",
      })
    }

    // Get applications for this lead if user is the creator
    let applications = []
    if (role === "lead-applier" && lead.created_by === userId) {
      const { data: appsData, error: appsError } = await supabase
        .from("applications")
        .select("*, profiles(*)")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })

      if (!appsError) {
        applications = appsData
      }
    }

    // Check if user has applied to this lead
    let userApplication = null
    if (role === "lead-finder") {
      const { data: appData, error: appError } = await supabase
        .from("applications")
        .select("*")
        .eq("lead_id", id)
        .eq("applicant_id", userId)
        .single()

      if (!appError) {
        userApplication = appData
      }
    }

    res.status(200).json({
      success: true,
      lead,
      applications: applications.length > 0 ? applications : undefined,
      userApplication: userApplication || undefined,
    })
  } catch (error) {
    console.error("Error fetching lead:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to fetch lead details",
    })
  }
})

// Create a new lead (lead-applier only)
router.post("/", verifyToken, checkRole(["lead-applier"]), async (req, res) => {
  try {
    const { title, description, category, location, credit_cost, tags } = req.body
    const { userId } = req.user

    // Validate required fields
    if (!title || !description || !category || !credit_cost) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "Title, description, category, and credit cost are required",
      })
    }

    // Create the lead
    const { data: lead, error } = await supabase
      .from("leads")
      .insert([
        {
          title,
          description,
          category,
          location: location || "Remote",
          credit_cost,
          tags: tags || [],
          created_by: userId,
          status: "active",
        },
      ])
      .select()
      .single()

    if (error) {
      console.error("Error creating lead:", error)
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to create lead",
      })
    }

    res.status(201).json({
      success: true,
      message: "Lead created successfully",
      lead,
    })
  } catch (error) {
    console.error("Error in create lead:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to create lead",
    })
  }
})

// Update a lead (lead-applier only, must be creator)
router.put("/:id", verifyToken, checkRole(["lead-applier"]), async (req, res) => {
  try {
    const { id } = req.params
    const { title, description, category, location, credit_cost, tags, status } = req.body
    const { userId } = req.user

    // Check if lead exists and user is the creator
    const { data: existingLead, error: fetchError } = await supabase
      .from("leads")
      .select("created_by")
      .eq("id", id)
      .single()

    if (fetchError) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
        message: "The requested lead does not exist",
      })
    }

    if (existingLead.created_by !== userId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
        message: "You don't have permission to update this lead",
      })
    }

    // Update the lead
    const { data: lead, error } = await supabase
      .from("leads")
      .update({
        title,
        description,
        category,
        location,
        credit_cost,
        tags,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating lead:", error)
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to update lead",
      })
    }

    res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      lead,
    })
  } catch (error) {
    console.error("Error in update lead:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to update lead",
    })
  }
})

// Delete a lead (lead-applier only, must be creator)
router.delete("/:id", verifyToken, checkRole(["lead-applier"]), async (req, res) => {
  try {
    const { id } = req.params
    const { userId } = req.user

    // Check if lead exists and user is the creator
    const { data: existingLead, error: fetchError } = await supabase
      .from("leads")
      .select("created_by")
      .eq("id", id)
      .single()

    if (fetchError) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
        message: "The requested lead does not exist",
      })
    }

    if (existingLead.created_by !== userId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
        message: "You don't have permission to delete this lead",
      })
    }

    // Delete the lead
    const { error } = await supabase.from("leads").delete().eq("id", id)

    if (error) {
      console.error("Error deleting lead:", error)
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to delete lead",
      })
    }

    res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
    })
  } catch (error) {
    console.error("Error in delete lead:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to delete lead",
    })
  }
})

module.exports = router
