import type { AxiosInstance } from "axios";

import axiosSetup from "./axiosSetup";
import type { IAxiosRoute } from "./types/types.types";

export const apiUrl = import.meta.env.VITE_PUBLIC_API_URL;

console.log("apiUrl", apiUrl);

const axiosBaseApi: AxiosInstance = axiosSetup(apiUrl, "");

export const axiosRoute: IAxiosRoute = {
  auth: {
    login: (payload) => axiosBaseApi.post("/auth/login", payload),
  },

  item: {
    getAll: () => axiosBaseApi.get("/item"),
    create: (payload) => axiosBaseApi.post("/item/create", payload),
    calculate: (payload) => axiosBaseApi.post("/item/calculate", payload),
    edit: (payload) => axiosBaseApi.put(`/item/${payload.id}`, payload),
    delete: (id) => axiosBaseApi.delete(`/item/${id}`),
    charge: (payload) => axiosBaseApi.post("/item/charge", payload),

    getTodayOrders: () => axiosBaseApi.get("/item/order-today"),
    deleteTodayOrder: (id) => axiosBaseApi.delete(`/item/order-today/${id}`),
    printTodayOrder: (id) => axiosBaseApi.post(`/item/order-today/${id}/print`),
  },

  payment: {
    getInfo: (query) => axiosBaseApi.get("/payment/info", { params: query }),

    getStats: () => axiosBaseApi.get("/payment/stats"),

    getFinance: (query) =>
      axiosBaseApi.get("/payment/finance", { params: query }),
  },

  customer: {
    getAll: () => axiosBaseApi.get("/customer/all"),
  },
};
