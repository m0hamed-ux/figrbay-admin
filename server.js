import express from 'express';
import dotenv from 'dotenv';
import supabase from './config/supabase.js';
import {generateToken, verifyToken} from "./config/auth.js"

const app = express();
app.use(express.json());
dotenv.config();
const PORT = process.env.PORT || 3000;





app.listen(PORT, () => {
  console.log(`port : ${PORT}`);
})