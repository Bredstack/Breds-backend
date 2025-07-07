const express = require('express');
const supabase = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Get user settings
router.get('/', verifyToken, async (req, res) => {
  try {
    // Log req.user for debugging
    console.log('Full req.user object:', req.user);

    // Validate req.user and req.user.id
    if (!req.user || !req.user.id) {
      console.error('No user or user ID in request:', req.user);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'No valid user ID found in token',
      });
    }

    const userId = req.user.id; // Use req.user.id
    console.log('Fetching settings for user ID:', userId);

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error('Invalid UUID format for userId:', userId);
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID',
        message: 'User ID must be a valid UUID',
      });
    }

    // Fetch profile from profiles table
    console.log('Executing Supabase query for userId:', userId);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        first_name,
        last_name,
        username,
        role,
        credits,
        profile_complete,
        bio,
        avatar_url,
        phone_number,
        address,
        company,
        position,
        years_of_experience,
        registration_step,
        website
      `)
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Supabase query error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: error.message || 'Failed to fetch user settings',
      });
    }

    if (!profile) {
      console.warn('No profile found for user ID:', userId);
      return res.status(404).json({
        success: false,
        error: 'Profile not found',
        message: 'User profile not found in profiles table',
      });
    }

    console.log('Profile fetched successfully:', profile);

    // Format the response to match UserSettings interface
    const settings = {
      profile: {
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        username: profile.username || '',
        email: profile.email || '',
        phoneNumber: profile.phone_number || '',
        bio: profile.bio || '',
        company: profile.company || '',
        position: profile.position || '',
        yearsOfExperience: profile.years_of_experience || 0,
        address: profile.address || '',
        website: profile.website || '',
        avatarUrl: profile.avatar_url || '',
      },
      notifications: {
        emailNotifications: false, // Default since not in profiles table
        smsNotifications: false,
        pushNotifications: false,
        leadUpdates: false,
        applicationUpdates: false,
        marketingEmails: false,
      },
      role: profile.role || 'lead-finder',
      verified: profile.profile_complete || false,
      credits: profile.credits || 0,
    };

    res.status(200).json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Unexpected error in get settings:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch user settings',
    });
  }
});

// Update user settings
router.put('/', verifyToken, async (req, res) => {
  try {
    // Log req.user for debugging
    console.log('Full req.user object:', req.user);

    // Validate req.user and req.user.id
    if (!req.user || !req.user.id) {
      console.error('No user or user ID in request:', req.user);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'No valid user ID found in token',
      });
    }

    const userId = req.user.id;
    console.log('Updating settings for user ID:', userId);

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error('Invalid UUID format for userId:', userId);
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID',
        message: 'User ID must be a valid UUID',
      });
    }

    const { profile, notifications } = req.body;

    // Prepare updates object
    const updates = {};

    // Update profile fields if provided
    if (profile) {
      if (profile.firstName !== undefined) updates.first_name = profile.firstName;
      if (profile.lastName !== undefined) updates.last_name = profile.lastName;
      if (profile.username !== undefined) updates.username = profile.username;
      if (profile.phoneNumber !== undefined) updates.phone_number = profile.phoneNumber;
      if (profile.bio !== undefined) updates.bio = profile.bio;
      if (profile.company !== undefined) updates.company = profile.company;
      if (profile.position !== undefined) updates.position = profile.position;
      if (profile.yearsOfExperience !== undefined) updates.years_of_experience = profile.yearsOfExperience;
      if (profile.address !== undefined) updates.address = profile.address;
      if (profile.website !== undefined) updates.website = profile.website;
      if (profile.avatarUrl !== undefined) updates.avatar_url = profile.avatarUrl;
    }

    // Skip notification updates since fields don't exist in profiles table
    // Log warning if notifications are sent
    if (notifications) {
      console.warn('Notification updates ignored; notification fields not in profiles table:', notifications);
    }

    // Only update if there are changes
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No updates provided',
        message: 'No settings were provided to update',
      });
    }

    // Add updated_at timestamp
    updates.updated_at = new Date().toISOString();

    // Update the profile
    console.log('Executing Supabase update query for userId:', userId, 'Updates:', updates);
    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select(`
        id,
        email,
        first_name,
        last_name,
        username,
        role,
        credits,
        profile_complete,
        bio,
        avatar_url,
        phone_number,
        address,
        company,
        position,
        years_of_experience,
        registration_step,
        website
      `)
      .single();

    if (error) {
      console.error('Supabase update error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: error.message || 'Failed to update settings',
      });
    }

    if (!updatedProfile) {
      console.warn('No profile found for update, user ID:', userId);
      return res.status(404).json({
        success: false,
        error: 'Profile not found',
        message: 'User profile not found',
      });
    }

    console.log('Profile updated successfully:', updatedProfile);
    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        profile: {
          firstName: updatedProfile.first_name || '',
          lastName: updatedProfile.last_name || '',
          username: updatedProfile.username || '',
          email: updatedProfile.email || '',
          phoneNumber: updatedProfile.phone_number || '',
          bio: updatedProfile.bio || '',
          company: updatedProfile.company || '',
          position: updatedProfile.position || '',
          yearsOfExperience: updatedProfile.years_of_experience || 0,
          address: updatedProfile.address || '',
          website: updatedProfile.website || '',
          avatarUrl: updatedProfile.avatar_url || '',
        },
        notifications: {
          emailNotifications: false,
          smsNotifications: false,
          pushNotifications: false,
          leadUpdates: false,
          applicationUpdates: false,
          marketingEmails: false,
        },
        role: updatedProfile.role || 'lead-finder',
        verified: updatedProfile.profile_complete || false,
        credits: updatedProfile.credits || 0,
      },
    });
  } catch (error) {
    console.error('Unexpected error in update settings:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to update settings',
    });
  }
});

module.exports = router;