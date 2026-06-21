const mongoose = require('mongoose');
const Run = require('../models/Run');
const User = require('../models/User');

/**
 * POST /api/runs
 * Save a new completed run.
 */
exports.createRun = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      distanceKm,
      durationSeconds,
      avgPaceMinPerKm,
      caloriesBurned,
      route,
      startedAt
    } = req.body;

    // Validate required fields
    if (
      distanceKm === undefined ||
      durationSeconds === undefined ||
      avgPaceMinPerKm === undefined ||
      caloriesBurned === undefined ||
      startedAt === undefined
    ) {
      return res.status(400).json({ error: 'Missing required run parameters' });
    }

    const run = new Run({
      user: userId,
      distanceKm,
      durationSeconds,
      avgPaceMinPerKm,
      caloriesBurned,
      route: route || [],
      startedAt
    });

    await run.save();
    console.log(`[RUNS] Saved completed run of ${distanceKm}km for user ${userId}.`);

    return res.status(201).json(run);
  } catch (error) {
    console.error('[RUNS] Create run error:', error);
    return res.status(500).json({ error: 'Server error saving run details' });
  }
};

/**
 * GET /api/runs
 * Return up to last 50 runs belonging to the logged-in user, sorted newest first.
 */
exports.getUserRuns = async (req, res) => {
  try {
    const userId = req.user.userId;

    const runs = await Run.find({ user: userId })
      .sort({ startedAt: -1 })
      .limit(50);

    return res.status(200).json(runs);
  } catch (error) {
    console.error('[RUNS] Get user runs error:', error);
    return res.status(500).json({ error: 'Server error retrieving runs history' });
  }
};

/**
 * GET /api/runs/:id
 * Return a single run's full details (including coordinates list).
 */
exports.getRunById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const runId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(runId)) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const run = await Run.findOne({ _id: runId, user: userId });
    
    if (!run) {
      // Return 404 for privacy (do not leak run existance if owned by another user)
      return res.status(404).json({ error: 'Run not found' });
    }

    return res.status(200).json(run);
  } catch (error) {
    console.error('[RUNS] Get run by ID error:', error);
    return res.status(500).json({ error: 'Server error retrieving run details' });
  }
};

/**
 * GET /api/runs/stats
 * Return aggregated stats for the dashboard: today distance/calories/steps, weekly distance, total counts, and weekly goal.
 */
exports.getRunStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Define dates for 24h (today) and 7d (weekly) thresholds
    const todayLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const weekLimit = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const userObjId = new mongoose.Types.ObjectId(userId);

    // 1. Run stats queries in parallel
    const [todayAggregation, weeklyAggregation, totalAggregation, totalRuns, user] = await Promise.all([
      Run.aggregate([
        {
          $match: {
            user: userObjId,
            startedAt: { $gte: todayLimit }
          }
        },
        {
          $group: {
            _id: null,
            todayDistanceKm: { $sum: '$distanceKm' },
            todayCalories: { $sum: '$caloriesBurned' },
            todayDurationSeconds: { $sum: '$durationSeconds' }
          }
        }
      ]),
      Run.aggregate([
        {
          $match: {
            user: userObjId,
            startedAt: { $gte: weekLimit }
          }
        },
        {
          $group: {
            _id: null,
            weeklyDistanceKm: { $sum: '$distanceKm' }
          }
        }
      ]),
      Run.aggregate([
        {
          $match: {
            user: userObjId
          }
        },
        {
          $group: {
            _id: null,
            totalDistanceKm: { $sum: '$distanceKm' }
          }
        }
      ]),
      Run.countDocuments({ user: userId }),
      User.findById(userId)
    ]);

    // Extract values with appropriate fallbacks
    const todayStats = todayAggregation[0] || { todayDistanceKm: 0, todayCalories: 0, todayDurationSeconds: 0 };
    const weeklyStats = weeklyAggregation[0] || { weeklyDistanceKm: 0 };
    const totalStats = totalAggregation[0] || { totalDistanceKm: 0 };

    const todayDistanceKm = todayStats.todayDistanceKm || 0;
    const todayCalories = todayStats.todayCalories || 0;
    const todayDurationSeconds = todayStats.todayDurationSeconds || 0;
    const weeklyDistanceKm = weeklyStats.weeklyDistanceKm || 0;
    const totalDistanceKm = totalStats.totalDistanceKm || 0;

    const todaySteps = Math.round(todayDistanceKm * 1300);
    const weeklyGoalKm = user?.profile?.weeklyGoalKm || 10; // Default to 10 if not set
    
    // Average pace for today: minutes / distance
    const todayAvgPaceMinPerKm = todayDistanceKm > 0 ? (todayDurationSeconds / 60) / todayDistanceKm : 0;

    return res.status(200).json({
      todayDistanceKm,
      todaySteps,
      todayCalories,
      todayAvgPaceMinPerKm: parseFloat(todayAvgPaceMinPerKm.toFixed(2)),
      weeklyDistanceKm,
      totalDistanceKm: parseFloat(totalDistanceKm.toFixed(2)),
      totalRuns,
      weeklyGoalKm
    });
  } catch (error) {
    console.error('[RUNS] Get stats error:', error);
    return res.status(500).json({ error: 'Server error computing dashboard aggregates' });
  }
};

/**
 * Helper to convert a Date into YYYY-MM-DD string representation in the local server environment.
 */
const getLocalDateString = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Calculates current and longest running streaks from a list of runs sorted by date descending.
 */
const calculateStreaks = (runs) => {
  if (!runs || runs.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Extract unique run dates as YYYY-MM-DD, sorted descending (newest first)
  const runDates = Array.from(
    new Set(runs.map(run => getLocalDateString(run.startedAt)))
  ).sort((a, b) => b.localeCompare(a));

  const todayStr = getLocalDateString(new Date());
  const yesterdayStr = getLocalDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));

  let currentStreak = 0;
  const hasRunToday = runDates.includes(todayStr);
  const hasRunYesterday = runDates.includes(yesterdayStr);

  if (hasRunToday || hasRunYesterday) {
    let checkDate = hasRunToday ? new Date() : new Date(Date.now() - 24 * 60 * 60 * 1000);
    while (true) {
      const checkDateStr = getLocalDateString(checkDate);
      if (runDates.includes(checkDateStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Longest streak
  let longestStreak = 0;
  if (runDates.length > 0) {
    let tempStreak = 1;
    longestStreak = 1;
    for (let i = 0; i < runDates.length - 1; i++) {
      const currentDate = new Date(runDates[i]);
      const nextDate = new Date(runDates[i + 1]);
      const diffTime = Math.abs(currentDate - nextDate);
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        tempStreak++;
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
      } else {
        tempStreak = 1;
      }
    }
  }

  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  return { currentStreak, longestStreak };
};

/**
 * GET /api/runs/streak
 * Calculate the user's current running streak and historically longest running streak.
 */
exports.getRunStreak = async (req, res) => {
  try {
    const userId = req.user.userId;
    const runs = await Run.find({ user: userId }).sort({ startedAt: -1 });
    const streaks = calculateStreaks(runs);
    return res.status(200).json(streaks);
  } catch (error) {
    console.error('[RUNS] Get streak error:', error);
    return res.status(500).json({ error: 'Server error calculating running streak' });
  }
};

/**
 * GET /api/runs/achievements
 * Check and aggregate user statistics against fixed achievement definitions.
 */
exports.getRunAchievements = async (req, res) => {
  try {
    const userId = req.user.userId;
    const runs = await Run.find({ user: userId }).sort({ startedAt: -1 });
    const { currentStreak, longestStreak } = calculateStreaks(runs);

    // Mongoose aggregation for sum and counts
    const stats = await Run.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalRuns: { $sum: 1 },
          totalDistanceKm: { $sum: '$distanceKm' },
          longestRunDistance: { $max: '$distanceKm' }
        }
      }
    ]);

    const totalRuns = stats[0]?.totalRuns || 0;
    const totalDistanceKm = stats[0]?.totalDistanceKm || 0;
    const longestRunDistance = stats[0]?.longestRunDistance || 0;

    // Early bird check: any run started before 7:00 AM local time
    const hasEarlyBird = runs.some(run => {
      const d = new Date(run.startedAt);
      return d.getHours() < 7;
    });

    const achievementsList = [
      { id: 'first_run', title: 'First Steps', description: 'Complete your first run', unlocked: totalRuns >= 1 },
      { id: 'five_runs', title: 'Getting Started', description: 'Complete 5 runs', unlocked: totalRuns >= 5 },
      { id: 'twenty_runs', title: 'Committed', description: 'Complete 20 runs', unlocked: totalRuns >= 20 },
      { id: 'first_5k', title: '5K Club', description: 'Run 5km in a single run', unlocked: longestRunDistance >= 5 },
      { id: 'first_10k', title: '10K Club', description: 'Run 10km in a single run', unlocked: longestRunDistance >= 10 },
      { id: 'hundred_km', title: 'Century', description: 'Run 100km total', unlocked: totalDistanceKm >= 100 },
      { id: 'early_bird', title: 'Early Bird', description: 'Complete a run before 7am', unlocked: hasEarlyBird },
      { id: 'week_streak', title: 'On Fire', description: '7-day running streak', unlocked: currentStreak >= 7 || longestStreak >= 7 }
    ];

    return res.status(200).json(achievementsList);
  } catch (error) {
    console.error('[RUNS] Get achievements error:', error);
    return res.status(500).json({ error: 'Server error calculating achievements' });
  }
};
