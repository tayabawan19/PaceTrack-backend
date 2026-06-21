const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Helper to generate a 6-digit random OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * POST /api/auth/signup
 * Register a new user or overwrite an unverified existing user.
 */
exports.signup = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      if (user.isVerified) {
        return res.status(400).json({ error: 'Email is already registered and verified' });
      }
      
      // If exists but not verified, allow overwriting (resend / update flow)
      console.log(`[AUTH] User ${email} already exists but is unverified. Overwriting credentials and resending OTP.`);
      user.password = password; // Pre-save hook will hash this modified password
    } else {
      // Create new user
      user = new User({
        email: email.toLowerCase(),
        password
      });
    }

    // Generate 6-digit OTP
    const otp = generateOTP();
    
    // Hash the OTP before saving
    const hashedOtp = await bcrypt.hash(otp, 10);
    
    user.otp = hashedOtp;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry
    user.isVerified = false;

    await user.save();

    console.log(`[AUTH] User record saved for ${email}.`);
    console.log(`[DEVELOPMENT HELP] OTP for ${email} is: ${otp}`);

    // Send email with OTP
    try {
      await sendEmail({
        to: user.email,
        subject: 'PaceTrack Email Verification',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #4A90E2;">Welcome to PaceTrack!</h2>
            <p>Thank you for signing up. Please use the following verification code to complete your registration:</p>
            <div style="font-size: 24px; font-weight: bold; background: #f0f0f0; padding: 10px 20px; display: inline-block; border-radius: 5px; margin: 10px 0;">
              ${otp}
            </div>
            <p style="color: #999; font-size: 12px;">This code expires in 5 minutes.</p>
          </div>
        `
      });
      console.log(`[AUTH] OTP email sent successfully to ${email}`);
    } catch (emailError) {
      console.error(`[AUTH] Failed to send verification email to ${email}:`, emailError.message);
      console.log(`[DEVELOPMENT HELP] Please configure EMAIL_USER and EMAIL_PASS to enable real email delivery.`);
    }

    return res.status(201).json({
      message: 'Signup successful. A verification code has been sent to your email.'
    });
  } catch (error) {
    console.error('[AUTH] Signup error:', error);
    return res.status(500).json({ error: 'Server error during signup' });
  }
};

/**
 * POST /api/auth/verify-otp
 * Verify the 6-digit OTP and activate user account.
 */
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP code are required' });
    }

    // Generic error to avoid revealing if email exists for invalid attempts
    const genericErrorResponse = () => {
      return res.status(400).json({ error: 'Invalid email or verification code' });
    };

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log(`[AUTH] OTP Verification failed: User with email ${email} not found.`);
      return genericErrorResponse();
    }

    // Check if OTP has expired
    if (!user.otpExpires || user.otpExpires < new Date()) {
      console.log(`[AUTH] OTP Verification failed: OTP has expired for ${email}.`);
      return res.status(400).json({ error: 'OTP expired, please request a new one' });
    }

    // Check if OTP matches
    if (!user.otp) {
      console.log(`[AUTH] OTP Verification failed: No active OTP record for ${email}.`);
      return genericErrorResponse();
    }

    const isMatch = await bcrypt.compare(otp, user.otp);
    if (!isMatch) {
      console.log(`[AUTH] OTP Verification failed: Incorrect OTP provided for ${email}.`);
      return genericErrorResponse();
    }

    // Mark as verified, clear OTP details
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    console.log(`[AUTH] User ${email} verified successfully.`);

    // Generate JWT (7 day expiry)
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'pacetrack_jwt_secret_dev_key',
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      token,
      user: {
        email: user.email,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error('[AUTH] Verify OTP error:', error);
    return res.status(500).json({ error: 'Server error during OTP verification' });
  }
};

/**
 * POST /api/auth/resend-otp
 * Regenerate and resend verification code.
 */
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Generate new OTP
    const otp = generateOTP();
    const hashedOtp = await bcrypt.hash(otp, 10);

    user.otp = hashedOtp;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    await user.save();

    console.log(`[AUTH] Resent OTP details saved for ${email}.`);
    console.log(`[DEVELOPMENT HELP] Resent OTP for ${email} is: ${otp}`);

    // Resend email
    try {
      await sendEmail({
        to: user.email,
        subject: 'PaceTrack Verification Code - Resend',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #4A90E2;">Your New PaceTrack Code</h2>
            <p>Use the following verification code to complete your registration:</p>
            <div style="font-size: 24px; font-weight: bold; background: #f0f0f0; padding: 10px 20px; display: inline-block; border-radius: 5px; margin: 10px 0;">
              ${otp}
            </div>
            <p style="color: #999; font-size: 12px;">This code expires in 5 minutes.</p>
          </div>
        `
      });
      console.log(`[AUTH] OTP email resent successfully to ${email}`);
    } catch (emailError) {
      console.error(`[AUTH] Failed to resend verification email to ${email}:`, emailError.message);
    }

    return res.status(200).json({
      message: 'A new verification code has been sent to your email.'
    });
  } catch (error) {
    console.error('[AUTH] Resend OTP error:', error);
    return res.status(500).json({ error: 'Server error while resending OTP' });
  }
};

/**
 * POST /api/auth/login
 * Log in a user.
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Generic error to avoid revealing if email exists vs password wrong
    const invalidCredentialsResponse = () => {
      return res.status(400).json({ error: 'Invalid email or password' });
    };

    if (!user) {
      console.log(`[AUTH] Login failed: User with email ${email} not found.`);
      return invalidCredentialsResponse();
    }

    // Check verification status first
    if (!user.isVerified) {
      console.log(`[AUTH] Login failed: User ${email} has not verified their email.`);
      return res.status(400).json({ error: 'Please verify your email before logging in' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`[AUTH] Login failed: Password incorrect for user ${email}.`);
      return invalidCredentialsResponse();
    }

    console.log(`[AUTH] User ${email} logged in successfully.`);

    // Generate JWT (7 day expiry)
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'pacetrack_jwt_secret_dev_key',
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      token,
      user: {
        email: user.email,
        isVerified: user.isVerified,
        profile: user.profile
      }
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    return res.status(500).json({ error: 'Server error during login' });
  }
};

/**
 * PUT /api/auth/profile
 * Update profile details (Protected route)
 */
exports.updateProfile = async (req, res) => {
  try {
    // req.user is attached by authMiddleware
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Extract profile fields
    const {
      name,
      age,
      gender,
      height,
      weight,
      units,
      fitnessLevel,
      goal,
      weeklyGoalKm,
      emergencyContactName,
      emergencyContactPhone
    } = req.body;

    // Apply updates selectively if provided
    if (name !== undefined) user.profile.name = name;
    if (age !== undefined) user.profile.age = age;
    if (gender !== undefined) user.profile.gender = gender;
    if (height !== undefined) user.profile.height = height;
    if (weight !== undefined) user.profile.weight = weight;
    if (units !== undefined) user.profile.units = units;
    if (fitnessLevel !== undefined) user.profile.fitnessLevel = fitnessLevel;
    if (goal !== undefined) user.profile.goal = goal;
    if (weeklyGoalKm !== undefined) user.profile.weeklyGoalKm = weeklyGoalKm;
    if (emergencyContactName !== undefined) user.profile.emergencyContactName = emergencyContactName;
    if (emergencyContactPhone !== undefined) user.profile.emergencyContactPhone = emergencyContactPhone;

    await user.save();

    console.log(`[AUTH] Profile updated for user ${user.email}.`);

    return res.status(200).json({
      email: user.email,
      isVerified: user.isVerified,
      profile: user.profile,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('[AUTH] Profile update error:', error);
    return res.status(500).json({ error: 'Server error updating profile' });
  }
};

/**
 * GET /api/auth/me
 * Fetch the logged-in user's profile details.
 */
exports.getMe = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).select('-password -otp -otpExpires');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json(user);
  } catch (error) {
    console.error('[AUTH] Get me profile error:', error);
    return res.status(500).json({ error: 'Server error retrieving current profile' });
  }
};
