const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/users"); // make sure this exports the model directly
require("dotenv").config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // ✅ Find existing user by Google ID
        let user = await User.findOne({
  $or: [
    { googleId: profile.id },
    { email: profile.emails?.[0]?.value }
  ]
});


        // ✅ If not found, create new one
        if (!user) {
          user = await User.create({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails?.[0]?.value,
            photo: profile.photos?.[0]?.value,
            role: null, // temporary default (overridden later)
            password: "google-oauth", // dummy placeholder
          });
          console.log("✅ New user created:", user.name);
        } else {
          console.log("🔁 Existing user:", user.name);
        }

        // ✅ Return user object to Passport
        return done(null, user);
      } catch (err) {
        console.error("❌ Error in GoogleStrategy:", err);
        return done(err, null);
      }
    }
  )
);

// ✅ Serialize user.id into session
passport.serializeUser((user, done) => {
  console.log("🟢 Serializing user:", user.id);
  done(null, user.id);
});

// ✅ Deserialize by finding user in MongoDB
passport.deserializeUser(async (id, done) => {
  console.log("🟡 Deserializing user:", id);
  try {
    const user = await User.findById(id);
    if (user) console.log("✅ Found user:", user.name);
    done(null, user);
  } catch (err) {
    console.error("❌ Deserialize error:", err);
    done(err, null);
  }
});

module.exports = passport;
