// lib/supabase-server.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseServerInstance: SupabaseClient | null = null;

function getSupabaseServer() {
    if (supabaseServerInstance) {
        return supabaseServerInstance;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase environment variables");
    }

    supabaseServerInstance = createClient(
        supabaseUrl,
        supabaseKey,
        {
            auth: {
                persistSession: false
            }
        }
    );

    return supabaseServerInstance;
}

const supabaseServer = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        const client = getSupabaseServer();
        return client[prop as keyof SupabaseClient];
    }
});

export default supabaseServer;