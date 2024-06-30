const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const path = require("path");
const bcrypt = require("bcrypt");
const axios = require("axios");

const app = express();

const serviceAccount = require("./Key.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.redirect("/signup");
});

app.get("/signup", (req, res) => {
  res.render("signup", { error: null });
});

app.post("/signup", async (req, res) => {
  const { username, email, phone, password, confirm_password } = req.body;

  console.log("Received signup request for:", username, email, phone);

  if (password !== confirm_password) {
    return res.render("signup", { error: "Passwords do not match" });
  }

  if (!/^\d{10}$/.test(phone)) {
    return res.render("signup", { error: "Phone number must be exactly 10 digits" });
  }

  try {
    const exist = await db.collection("data").where("email", "==", email).get();

    console.log("Existence check result:", exist.empty);

    if (!exist.empty) {
      return res.render("signup", { error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userRef = await db.collection("data").add({
      username,
      email,
      phone,
      password: hashedPassword,
    });

    console.log("User added with ID:", userRef.id);

    res.redirect("/login");
  } catch (err) {
    console.error("Error adding user:", err);
    res.status(500).send("Error: " + err.message);
  }
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const exist = await db.collection("data").where("email", "==", email).get();
    if (exist.empty) {
      return res.render("login", { error: "Invalid email or password" });
    }
    const user = exist.docs[0].data();
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      res.render("dashboard", { username: user.username, nutrition: null });
    } else {
      return res.render("login", { error: "Invalid email or password" });
    }
  } catch (err) {
    console.error("Error logging in:", err);
    res.status(500).send("Error: " + err.message);
  }
});

const getNutritionData = async (foodItem) => {
  const apiKey = '5WyC4cjAYjH7WJnkyytSbQ==3hkxXBPn8BbXIPk2';
  const url = `https://api.api-ninjas.com/v1/nutrition?query=${foodItem}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'X-Api-Key': apiKey,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching nutrition data:', error);
    throw error;
  }
};

app.get("/dashboard", (req, res) => {
  res.render("dashboard", { username: "User", nutrition: null });
});

app.post("/dashboard", async (req, res) => {
  const { foodItem } = req.body;

  try {
    const nutrition = await getNutritionData(foodItem);
    res.render("dashboard", { username: "User", nutrition });
  } catch (error) {
    console.error("Error fetching nutrition data:", error);
    res.status(500).send("Error: " + error.message);
  }
});

app.get("/logout", (req, res) => {
  res.redirect("/login");
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
