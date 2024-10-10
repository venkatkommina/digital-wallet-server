import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import { connectToMongoDB } from "./db.js";
import mainRouter from "./routes/index.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/v1", mainRouter);

const startServer = async () => {
  try {
    await connectToMongoDB();
    app.listen(5000, () => {
      console.log("Server started on port 5000");
    });
  } catch (e) {
    console.log(e);
  }
};

startServer();
