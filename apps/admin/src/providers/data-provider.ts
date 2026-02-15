import axios from "axios";
import type { DataProvider } from "@refinedev/core";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:7001";
const TOKEN_KEY = "martly_admin_token";

const axiosInstance = axios.create({ baseURL: `${API_URL}/api/v1` });

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const martlyDataProvider: DataProvider = {
  getList: async ({ resource, pagination, sorters }) => {
    const { current = 1, pageSize = 20 } = pagination ?? {};
    const params: Record<string, string | number> = { page: current, pageSize };

    if (sorters && sorters.length > 0) {
      params.sortBy = sorters[0].field;
      params.sortOrder = sorters[0].order;
    }

    const { data: res } = await axiosInstance.get(`/${resource}`, { params });
    return { data: res.data, total: res.meta?.total ?? res.data.length };
  },

  getOne: async ({ resource, id }) => {
    const { data: res } = await axiosInstance.get(`/${resource}/${id}`);
    return { data: res.data };
  },

  create: async ({ resource, variables }) => {
    const { data: res } = await axiosInstance.post(`/${resource}`, variables);
    return { data: res.data };
  },

  update: async ({ resource, id, variables }) => {
    const { data: res } = await axiosInstance.put(`/${resource}/${id}`, variables);
    return { data: res.data };
  },

  deleteOne: async ({ resource, id }) => {
    const { data: res } = await axiosInstance.delete(`/${resource}/${id}`);
    return { data: res.data };
  },

  getApiUrl: () => `${API_URL}/api/v1`,
};
