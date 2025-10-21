import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import supabase from './config/supabase.js';
import {generateToken, verifyToken} from "./config/auth.js"

const app = express();

// Configure CORS
app.use(cors({
    origin: '*', // Allow all origins - you can restrict this to specific domains in production
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());
dotenv.config();
const PORT = process.env.PORT || 3000;


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

app.post("/addAnnonce", async (req, res) => {
    const header = req.headers['authorization']
    const token = header && header.split(' ')[1]
    const user = verifyToken(token)
    const {titre, description, category, prix} = req.body
    const { data, error } = await supabase
        .from("annonces")
        .insert([{
            titre: titre,
            description: description,
            category: category,
            prix: prix,
            annonceur: user.id
        }])
        .select()
    if (error) return req.status(400).json(error)
})

app.get("/annonces", async (req, res) => {
    const {data, error} = await supabase
        .from("annonces")
        .select("*, annonceur(fullname)")
    if (error) return res.status(400).json(error)
    res.json(data)
})

app.post("/deleteAnnonce", async (req, res) => {
    const header = req.headers['authorization']
    const token = header && header.split(' ')[1]
    const user = verifyToken(token)
    const { annonceId } = req.body
    const { data, error } = await supabase
        .from("annonces")
        .delete()
        .eq("id", annonceId)
        .eq("annonceur", user.id)
    if (error) return res.status(400).json(error)
    res.json({ message: "done" })
})

app.post("/updateAnnonce", async (req, res) => {
    const header = req.headers['authorization']
    const token = header && header.split(' ')[1]
    const user = verifyToken(token)
    const { annonceId, titre, description, category, prix } = req.body
    const { data, error } = await supabase
        .from("annonces")
        .update({
            titre: titre,
            description: description,
            category: category,
            prix: prix
        })
        .eq("id", annonceId)
        .eq("annonceur", user.id)
        .select()
    if (error) return res.status(400).json(error)
    res.json(data[0])
})

app.post("/createChat", async (req, res) => {
    const header = req.headers['authorization']
    const token = header && header.split(' ')[1]
    const user = verifyToken(token)
    const { annonceId } = req.body
    const userId = user.id
    const { data, error } = await supabase
        .from("chats")
        .insert([{
            annonce: annonceId,
            buyer: userId
        }])
        .select()
    if (error) return res.status(400).json(error)
    res.json(data[0])
})

app.get("/chats", async (req, res) => {
    const header = req.headers['authorization']
    const token = header && header.split(' ')[1]
    const user = verifyToken(token)
    const { data, error } = await supabase
        .from("chats")
        .select("*, annonce(*, annonceur(fullname)), buyer(fullname)")
        .or(`annonce.annonceur.eq.${user.id},buyer.eq.${user.id}`)
    if (error) return res.status(400).json(error)
    res.json(data)
})

app.get("/messages", async (req, res) => {
    const { chatId } = req.query
    const { data, error } = await supabase
        .from("messages")
        .select("*, sender(id, fullname)")
        .eq("chat", chatId)
    if (error) return res.status(400).json(error)
    res.json(data)
})

app.post("/sendMessage", async (req, res) => {
    const header = req.headers['authorization']
    const token = header && header.split(' ')[1]
    const user = verifyToken(token)
    const { chatId, content } = req.body
    const { data, error } = await supabase
        .from("messages")
        .insert([{
            chat: chatId,
            sender: user.id,
            content: content
        }])
        .select()
    if (error) return res.status(400).json(error)
    res.json(data[0])
})

app.post("/addOrder", async (req, res) => {
    const header = req.headers['authorization']
    const token = header && header.split(' ')[1]
    const user = verifyToken(token)
    const { annonceId, address } = req.body
    const { data, error } = await supabase
        .from("orders")
        .insert([{
            annonce: annonceId,
            buyer: user.id,
            address: address
        }])
        .select()
    if (error) return res.status(400).json(error)
    res.json(data[0])
})

app.get("/orders", async (req, res) => {
    const header = req.headers['authorization']
    const token = header && header.split(' ')[1]
    const user = verifyToken(token)
    const { data, error } = await supabase
        .from("orders")
        .select("*, annonce(*, annonceur(fullname)), buyer(fullname)")
        .eq("buyer", user.id)
    if (error) return res.status(400).json(error)
    res.json(data)
})

app.listen(PORT, () => {
  console.log(`port : ${PORT}`);
})