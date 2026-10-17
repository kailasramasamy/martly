import dotenv from "dotenv";

// apps/api/.env is this app's config: it wins over variables exported by the developer's shell (e.g. a stale
// OPENAI_API_KEY in ~/.zshrc). Deployed images have no .env (.dockerignore), so platform variables apply there.
// Imported first by server.ts, before any module reads process.env at load time.
dotenv.config({ override: true });
