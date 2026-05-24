// ============================================================
// worker.js — Cloudflare Worker + Durable Objects
// Fixed: removed infinite-loop self-fetch at "/"
// ============================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const id = env.MyDatabase.idFromName("main");
    const obj = env.MyDatabase.get(id);

    // Forward all API routes to the Durable Object
    return obj.fetch(request);
  }
};

export class MyDatabase {
  constructor(state, env) {
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // CORS headers — required so the frontend (Pages) can call this Worker
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight (browser sends OPTIONS before POST)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // POST /add  — store a record
    if (url.pathname === "/add" && request.method === "POST") {
      try {
        const { name, email } = await request.json();
        if (!name || !email) {
          return new Response(
            JSON.stringify({ error: "name and email are required" }),
            { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } }
          );
        }
        // Store with timestamp so we can sort later
        await this.storage.put(`record:${Date.now()}:${name}`, { name, email, addedAt: new Date().toISOString() });
        return new Response(
          JSON.stringify({ success: true, message: `Added ${name}` }),
          { headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ error: "Invalid JSON body" }),
          { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      }
    }

    // GET /list  — return all records
    if (url.pathname === "/list" && request.method === "GET") {
      const entries = await this.storage.list({ prefix: "record:" });
      const records = [...entries.values()];
      // Sort newest first
      records.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
      return new Response(
        JSON.stringify(records),
        { headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    // DELETE /delete?name=xxx  — remove a record by key
    if (url.pathname === "/delete" && request.method === "DELETE") {
      const key = url.searchParams.get("key");
      if (key) await this.storage.delete(key);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
}