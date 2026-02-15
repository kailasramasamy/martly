import dataProvider from "@refinedev/simple-rest";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export const martlyDataProvider = dataProvider(`${API_URL}/api/v1`);
