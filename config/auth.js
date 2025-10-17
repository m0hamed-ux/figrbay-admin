import jsonwebtoken from "jsonwebtoken"
import dotenv from 'dotenv';

dotenv.config();

export function generateToken(user) {
  return jsonwebtoken.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '3600h' })
}

export function verifyToken(token){
    return jsonwebtoken.verify(token,process.env.JWT_SECRET)
}