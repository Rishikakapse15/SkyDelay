import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    savedAirports: [{ type: String }], // e.g. ["DFW", "BLR", "ORD"]
    savedFlights: [{ type: String }],  // e.g. ["AA200", "UA100"]
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);