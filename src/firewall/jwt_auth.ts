"use server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export default async function auth_jwt(email: string) {

    const token = jwt.sign({ email }, process.env.JWT_SECRET || "", { expiresIn: "7d" });

    const cookieStore = await cookies();
    cookieStore.set({
        name: "token",
        value: token,
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
    });

    return { error: false, email };
}