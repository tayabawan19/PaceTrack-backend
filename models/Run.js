const mongoose = require('mongoose');

const runSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true // Indexed for queries and aggregations
  },
  distanceKm: {
    type: Number,
    required: [true, 'Distance is required']
  },
  durationSeconds: {
    type: Number,
    required: [true, 'Duration is required']
  },
  avgPaceMinPerKm: {
    type: Number,
    required: [true, 'Average pace is required']
  },
  caloriesBurned: {
    type: Number,
    required: [true, 'Calories burned is required']
  },
  route: [
    {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      timestamp: { type: Date, required: true }
    }
  ],
  startedAt: {
    type: Date,
    required: [true, 'Start date/time is required']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Run', runSchema);
