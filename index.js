import express from 'express';
import dotenv from 'dotenv';
import supabase from './config/supabase.js';
import {generateToken, verifyToken} from "./config/auth.js"

const app = express();
app.use(express.json());
dotenv.config();
const PORT = process.env.PORT || 3000;

app.get('/', async (req, res) => {
    const users = await supabase
        .from("users")
        .select("*")
    res.json(users);
})


app.post('/signup', async (req, res) => {
    const { fullname, email, password } = req.body
    if (!email || !password){
        res.status(400).json({ error : "error"})
    }
    const { data, error } = await supabase
        .from("users")
        .insert([{
            fullname: fullname,
            email: email,
            password: password
        }])
        .select()
    if (error) return res.status(400).json(error)
    const token = generateToken(data[0])
    res.json({token: token})
})

app.post('/login', async (req, res) => {
    const { email, password } = req.body
    if (!email || !password){
        res.status(400).json({ error : "error"})
    }
    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single()
    if (error) return res.status(400).json(error)
    if (password != data.password) return res.status(400).json({error : "invalide password"})
    const token = generateToken(data)
    res.json({token: token})
})

app.get("/profile", async (req, res) => {
    const header = req.headers['authorization']
    const token = header && header.split(' ')[1]
    const user = verifyToken(token)
    const {data, error} = await supabase
        .from("users")
        .select("fullname, email")
        .eq("id", user.id)
        .single()
    if (error) return res.status(400).json(error)
    res.json(data)
})


app.listen(PORT, () => {
  console.log(`port : ${PORT}`);
})