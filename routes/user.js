import express from "express";
import zod from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Account, User } from "../db.js";
import { authMiddleware } from "./middleware.js";

const router = express.Router();
router.use(express.json());

const userSchema = zod.object({
  email: zod.string().email().min(3).max(30),
  password: zod.string().min(6),
  firstName: zod.string().min(1).max(50),
  lastName: zod.string().max(50),
});

router.post("/signup", async (req, res) => {
  try {
    const parsedResult = userSchema.safeParse(req.body);
    if (!parsedResult.success) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const { email, password, firstName, lastName } = parsedResult.data;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
    });

    await user.save();

    const balance = 1 + Math.random() * 10000;
    const account = new Account({
      userId: user._id,
      balance,
    });

    await account.save();

    const token = jwt.sign(
      {
        email: user.email,
        id: user._id,
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "30d" }
    );

    res.status(201).json({
      message: "User created successfully and initialized balance succesfully",
      userId: user._id,
      balance,
      email: user.email,
      token,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { email: user.email, id: user._id },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "30d" }
    );

    res.status(200).json({ email: user.email, userId: user._id, token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/bulk", authMiddleware, async (req, res) => {
  const filter = req.query.filter || "";

  const users = await User.find({
    $or: [
      {
        firstName: {
          $regex: filter,
          $options: "i",
        },
      },
      {
        lastName: {
          $regex: filter,
          $options: "i",
        },
      },
    ],
  });

  res.json({
    users: users.map((user) => ({
      //to not send password
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      _id: user._id,
    })),
    userId: req.userId,
  });
});

router.get("/me", authMiddleware, async (req, res) => {
  const user = await User.findOne({ _id: req.userId });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.status(200).json({ user });
});

router.put("/", authMiddleware, async (req, res) => {
  try {
    const { password, firstName, lastName } = req.body;
    const updates = {};

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.password = hashedPassword;
    }

    if (firstName) {
      updates.firstName = firstName;
    }

    if (lastName) {
      updates.lastName = lastName;
    }

    const user = await User.updateOne({ _id: req.userId }, updates);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User updated", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
