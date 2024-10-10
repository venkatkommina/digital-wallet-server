import express from "express";
import { Account, User } from "../db.js";
import { authMiddleware } from "./middleware.js";
import mongoose from "mongoose";

const router = express.Router();

router.get("/balance", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const userAccount = await Account.findOne({ userId });

  res.status(200).json({ balance: userAccount.balance });
});

router.post("/transfer", authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  const { toAccountId, amount } = req.body;
  const userId = req.userId;
  const userAccount = await Account.findOne({ userId }).session(session);

  if (!userAccount || userAccount.balance < amount) {
    await session.abortTransaction();
    return res.status(400).json({ message: "Insufficient balance" });
  }

  const toAccount = await Account.findOne({ userId: toAccountId }).session(
    session
  );
  if (!toAccount) {
    await session.abortTransaction();
    return res.status(400).json({ message: "Account not found" });
  }

  await Account.updateOne({ userId }, { $inc: { balance: -amount } });
  await Account.updateOne(
    { userId: toAccountId },
    { $inc: { balance: amount } }
  );
  await session.commitTransaction();
  res.status(200).json({ message: "Transfer successful" });
});

export default router;
