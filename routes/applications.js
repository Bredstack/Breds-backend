const express = require("express");
const supabase = require("../config/supabase");
const { verifyToken, checkRole } = require("../middleware/auth");

const router = express.Router();

// Get all applications for a user
router.get("/", verifyToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    console.log("Fetching applications for user:", { userId, role });

    if (!userId) {
      console.error("User ID is undefined in request:", { user: req.user });
      return res.status(400).json({
        success: false,
        error: "Invalid user",
        message: "User ID is missing",
      });
    }

    let applications = [];

    if (role === "lead-finder") {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          *,
          lead:leads(*)
        `)
        .eq("applicant_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching applications:", error);
        return res.status(500).json({
          success: false,
          error: "Database error",
          message: error.message || "Failed to fetch applications",
        });
      }

      applications = data || [];
    } else if (role === "lead-applier") {
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("id")
        .eq("created_by", userId);

      if (leadsError) {
        console.error("Error fetching leads:", leadsError);
        return res.status(500).json({
          success: false,
          error: "Database error",
          message: "Failed to fetch leads",
        });
      }

      if (leadsData && leadsData.length > 0) {
        const leadIds = leadsData.map((lead) => lead.id);
        const { data: applicationsData, error: applicationsError } = await supabase
          .from("applications")
          .select(`
            *,
            lead:leads(*),
            applicant:profiles(*)
          `)
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false });

        if (applicationsError) {
          console.error("Error fetching applications:", applicationsError);
          return res.status(500).json({
            success: false,
            error: "Database error",
            message: "Failed to fetch applications",
          });
        }

        applications = applicationsData || [];
      }
    }

    res.status(200).json({
      success: true,
      applications,
    });
  } catch (error) {
    console.error("Error in get applications:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to fetch applications",
    });
  }
});

// Create a new application (lead-finder only)
router.post("/", verifyToken, checkRole(["lead-finder"]), async (req, res) => {
  try {
    const { leadId, message } = req.body;
    const { id: userId } = req.user;

    console.log("Creating application:", { leadId, userId });

    // Validate required fields
    if (!leadId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "Lead ID is required",
      });
    }

    // Check application count (max 6 per lead)
    const { data: countData, error: countError } = await supabase.rpc("count_lead_applications", {
      lead_id: leadId,
    });

    if (countError) {
      console.error("Error counting applications:", countError);
      return res.status(500).json({
        success: false,
        error: "Failed to check application count",
        message: countError.message,
      });
    }

    if (countData >= 6) {
      console.warn("Maximum applications reached:", { leadId, count: countData });
      return res.status(400).json({
        success: false,
        error: "This lead has reached the maximum number of applications",
        maxReached: true,
      });
    }

    // Check if lead exists and is active
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*, profiles(credits)")
      .eq("id", leadId)
      .eq("status", "active")
      .single();

    if (leadError) {
      console.error("Error fetching lead:", leadError);
      return res.status(404).json({
        success: false,
        error: "Lead not found",
        message: "The requested lead does not exist or is not active",
      });
    }

    // Check if user has already applied to this lead
    const { data: existingApp, error: existingError } = await supabase
      .from("applications")
      .select("id")
      .eq("lead_id", leadId)
      .eq("applicant_id", userId)
      .single();

    if (existingApp) {
      return res.status(409).json({
        success: false,
        error: "Already applied",
        message: "You have already applied to this lead",
      });
    }

    // Check if user has enough credits
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return res.status(500).json({
        success: false,
        error: "Profile error",
        message: "Failed to check user credits",
      });
    }

    if (profile.credits < lead.credit_cost) {
      return res.status(402).json({
        success: false,
        error: "Insufficient credits",
        requiredCredits: lead.credit_cost,
        availableCredits: profile.credits,
      });
    }

    // Final application count check
    const { data: finalCountData, error: finalCountError } = await supabase.rpc("count_lead_applications", {
      lead_id: leadId,
    });

    if (finalCountError) {
      console.error("Error counting applications (final check):", finalCountError);
      return res.status(500).json({
        success: false,
        error: "Failed to check application count",
        message: finalCountError.message,
      });
    }

    if (finalCountData >= 6) {
      console.warn("Maximum applications reached (final check):", { leadId, count: finalCountData });
      return res.status(400).json({
        success: false,
        error: "This lead has reached the maximum number of applications",
        maxReached: true,
      });
    }

    // Create application (auto-accepted to match frontend logic)
    const { data: application, error: appError } = await supabase
      .from("applications")
      .insert([
        {
          lead_id: leadId,
          applicant_id: userId,
          message: message || "Lead purchased",
          status: "accepted",
        },
      ])
      .select()
      .single();

    if (appError) {
      console.error("Error creating application:", appError);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to create application",
      });
    }

    // Deduct credits from user
    const newCredits = profile.credits - lead.credit_cost;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ credits: newCredits })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating credits:", updateError);
      // Rollback application
      await supabase.from("applications").delete().eq("id", application.id);
      return res.status(500).json({
        success: false,
        error: "Credits update failed",
        message: "Failed to update user credits",
      });
    }

    // Record credit transaction
    const { error: creditError } = await supabase.from("credits").insert([
      {
        user_id: userId,
        amount: -lead.credit_cost,
        description: `Purchased lead: ${lead.title}`,
        transaction_type: "lead_purchase",
      },
    ]);

    if (creditError) {
      console.error("Error recording credit transaction:", creditError);
      // Continue, as credits are already deducted
    }

    res.status(201).json({
      success: true,
      message: "Lead purchased successfully",
      application,
      remainingCredits: newCredits,
    });
  } catch (error) {
    console.error("Error in create application:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to submit application",
    });
  }
});

// Update application status (lead-applier only)
router.put("/:id", verifyToken, checkRole(["lead-applier"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { id: userId } = req.user;

    // Validate status
    if (!["accepted", "rejected", "pending"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status",
        message: "Status must be 'accepted', 'rejected', or 'pending'",
      });
    }

    // Check if application exists and user is the lead creator
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("*, leads(created_by)")
      .eq("id", id)
      .single();

    if (appError) {
      console.error("Error fetching application:", appError);
      return res.status(404).json({
        success: false,
        error: "Application not found",
        message: "The requested application does not exist",
      });
    }

    if (application.leads.created_by !== userId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
        message: "You don't have permission to update this application",
      });
    }

    // If accepting, check for existing accepted applications
    if (status === "accepted") {
      const { data: existingAccepted, error: existingError } = await supabase
        .from("applications")
        .select("id")
        .eq("lead_id", application.lead_id)
        .eq("status", "accepted")
        .neq("id", id)
        .single();

      if (existingAccepted) {
        return res.status(409).json({
          success: false,
          error: "Already accepted",
          message: "Another application has already been accepted for this lead",
        });
      }

      // Update lead's assigned_to field
      await supabase
        .from("leads")
        .update({
          assigned_to: application.applicant_id,
          assigned_at: new Date().toISOString(),
        })
        .eq("id", application.lead_id);
    }

    // Update application status
    const { data: updatedApp, error } = await supabase
      .from("applications")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating application:", error);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Failed to update application status",
      });
    }

    res.status(200).json({
      success: true,
      message: `Application ${status}`,
      application: updatedApp,
    });
  } catch (error) {
    console.error("Error in update application:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to update application status",
    });
  }
});

module.exports = router;