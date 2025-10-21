import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import supabase from './config/supabase.js';
import {generateToken, verifyToken} from "./config/auth.js"
import multer from 'multer';

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
        .select("*")
        .eq("id", user.id)
        .single()
    if (error) return res.status(400).json(error)
    res.json(data)
})

app.post("/updateProfile", async (req, res) => {
    const upload = multer({ storage: multer.memoryStorage() }).single('pic');

    upload(req, res, async (uploadErr) => {
        if (uploadErr) return res.status(400).json({ error: uploadErr.message });

        try {
            const header = req.headers['authorization']
            const token = header && header.split(' ')[1]
            const user = verifyToken(token)

            const { fullname, email, tel, location } = req.body

            // Build update payload and remove undefined/null values
            const updatePayload = {
                fullname: fullname,
                email: email,
                tel: tel,
                location: location
            }
            Object.keys(updatePayload).forEach(k => {
                if (updatePayload[k] === undefined || updatePayload[k] === null || updatePayload[k] === "") delete updatePayload[k]
            })

            // If a file was uploaded, validate & upload to storage, then set pic URL
            if (req.file) {
                const file = req.file
                const allowedMime = ['image/jpeg', 'image/jpg', 'image/png']
                const MAX_SIZE = 1 * 1024 * 1024 // 1MB

                if (!allowedMime.includes(file.mimetype)) {
                    return res.status(400).json({ error: "Invalid file type. Allowed: JPG, JPEG, PNG" })
                }
                if (file.size > MAX_SIZE) {
                    return res.status(400).json({ error: "File exceeds size limit of 1MB" })
                }

                const safeName = file.originalname.replace(/\s+/g, '_')
                const filename = `users/${user.id}/profile_${Date.now()}_${safeName}`

                const { error: uploadError } = await supabase.storage
                    .from('images')
                    .upload(filename, file.buffer, {
                        contentType: file.mimetype,
                        upsert: false,
                    })

                if (uploadError) {
                    console.error('Supabase upload error:', uploadError)
                    return res.status(400).json({ error: uploadError.message || uploadError })
                }

                const publicUrlResp = supabase.storage.from('images').getPublicUrl(filename);
                const publicUrl = publicUrlResp?.data?.publicUrl;

                updatePayload.pic = publicUrl
            }

            const { data, error } = await supabase
                .from("users")
                .update(updatePayload)
                .eq("id", user.id)
                .select()

            if (error) return res.status(400).json(error)
            res.json(data[0])
        } catch (e) {
            res.status(400).json({ error: e.message })
        }
    })
})


app.post("/addAnnonce", async (req, res) => {
    const upload = multer({ storage: multer.memoryStorage() }).array('images', 10);

    upload(req, res, async (uploadErr) => {
        if (uploadErr) return res.status(400).json({ error: uploadErr.message });

        try {
            const header = req.headers['authorization'];
            const token = header && header.split(' ')[1];
            const user = verifyToken(token);

            // Basic required fields
            const { 
                titre,
                nom_produit, // "Nom de produit"
                description,
                category,
                prix,
                quantite,
                marque,
                couleur,
                taille,
                etat, // état du produit
                delai_estime, // délai estimé
                methode_envoi // méthode d'envoi
            } = req.body;

            // Validate required fields (those marked with *)
            if (!titre || !description || !category || (prix === undefined || prix === null)) {
                return res.status(400).json({ error: "Missing required fields: titre, description, category, prix" });
            }

            const files = req.files || [];

            // Images are marked as required in the UI - enforce at least one image
            if (!files.length) {
                return res.status(400).json({ error: "At least one image is required" });
            }

            // Validate files: only JPG/JPEG/PNG and less than 1MB
            const allowedMime = ['image/jpeg', 'image/jpg', 'image/png'];
            const MAX_SIZE = 1 * 1024 * 1024; // 1MB
            for (const file of files) {
                if (!allowedMime.includes(file.mimetype)) {
                    return res.status(400).json({ error: `Invalid file type for ${file.originalname}. Allowed: JPG, JPEG, PNG` });
                }
                if (file.size > MAX_SIZE) {
                    return res.status(400).json({ error: `File ${file.originalname} exceeds size limit of 1MB` });
                }
            }

            // Prepare annonce payload. Put optional extra details into a JSON 'details' field so schema stays flexible.
            const annoncePayload = {
                titre: titre,
                nom_produit: nom_produit || null,
                description: description,
                category: category,
                prix: prix,
                annonceur: user.id,
                details: {
                    quantite: quantite ? Number(quantite) : undefined,
                    marque: marque || undefined,
                    couleur: couleur || undefined,
                    taille: taille || undefined,
                    etat: etat || undefined,
                    delai_estime: delai_estime || undefined,
                    methode_envoi: methode_envoi || undefined
                }
            };

            // Remove undefined props inside details so DB doesn't get keys with undefined
            Object.keys(annoncePayload.details).forEach(k => {
                if (annoncePayload.details[k] === undefined) delete annoncePayload.details[k];
            });

            // create the annonce first
            const { data: annonceData, error: annonceError } = await supabase
                .from("annonces")
                .insert([annoncePayload])
                .select();

            if (annonceError) return res.status(400).json(annonceError);
            const annonce = annonceData[0];

            // handle file uploads
            const imagesToInsert = [];

            for (const file of files) {
                // create a unique path for each file
                const safeName = file.originalname.replace(/\s+/g, '_');
                const filename = `annonces/${annonce.id}/${Date.now()}_${safeName}`;

                // upload to Supabase storage bucket "images"
                const { error: uploadError } = await supabase.storage
                    .from('images')
                    .upload(filename, file.buffer, {
                        contentType: file.mimetype,
                        upsert: false,
                    });

                if (uploadError) {
                    // continue on upload failures for individual files but log them
                    console.error('Supabase upload error:', uploadError);
                    continue;
                }

                // get public URL for the uploaded file
                const publicUrlResp = supabase.storage.from('images').getPublicUrl(filename);
                // support both possible shapes returned by getPublicUrl
                const publicUrl = (publicUrlResp?.data?.publicUrl) || (publicUrlResp?.publicURL) || (publicUrlResp?.data?.publicURL);

                imagesToInsert.push({
                    annonce: annonce.id,
                    url: publicUrl,
                    filename: filename,
                });
            }

            // insert image records into "images" table
            if (imagesToInsert.length > 0) {
                const { data: imagesData, error: imagesError } = await supabase
                    .from("images")
                    .insert(imagesToInsert)
                    .select();

                if (imagesError) return res.status(400).json(imagesError);

                // attach images to response
                annonce.images = imagesData;
            } else {
                annonce.images = [];
            }

            res.json(annonce);
        } catch (e) {
            res.status(400).json({ error: e.message });
        }
    });
});



app.get("/annonces", async (req, res) => {
    const {data, error} = await supabase
        .from("annonces")
        .select("*, annonceur(fullname, tel, location, pic), images(*)")
    if (error) return res.status(400).json(error)
    res.json(data)
})

app.get("/annonce/:id", async (req, res) => {
    const { id } = req.params
    const {data, error} = await supabase
        .from("annonces")
        .select("*, annonceur(fullname, tel, location, pic), images(*)")
        .eq("id", id)
        .single()
    if (error) return res.status(400).json(error)
    res.json(data)
})

app.get("/mesannonces", async (req, res) => {
    const header = req.headers['authorization']
    const token = header && header.split(' ')[1]
    const user = verifyToken(token)
    const {data, error} = await supabase
        .from("annonces")
        .select("*, annonceur(fullname)")
        .eq("annonceur", user.id)
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