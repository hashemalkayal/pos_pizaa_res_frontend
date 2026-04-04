import type { IFinancePeriod } from "./req";

export interface ILoginResponse {
  accessToken: string;
}

export interface IItem {
  id: number;
  name: string;
  price: number;
  ingredients: string[];
}

export interface ICategory {
  id: number;
  name: string;
}

export interface ICategoryWithItems {
  category: ICategory;
  items: IItem[];
}

export interface ICreateItemResponse {
  id: number;
  name: string;
  price: number;
  ingredients: string;
  categoryId: number;
}

export interface ICalculateItemResponse {
  itemName: string;
  quantity: number;
  pricePerUnit: number;
  baseTotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
}

export interface IDeleteItemResponse {}

export interface IOrderItem {
  id: number;
  quantity: number;
  itemId: number;
  orderId: number;
}

export interface IChargeItemResponse {
  orderItems: IOrderItem[];
  id: number;
  discount: number;
  date: Date;
  totalAmount: number;
  userId: number;
}

export interface IPaymentItem {
  quantity: number;
  item: {
    id: number;
    name: string;
    price: number;
    ingredients: string;
    categoryId: number;
  };
}

export interface IPaymentInfo {
  id: number;
  date: Date;
  totalAmount: number;
  orderNumber: number;
  paymentMethod: string;
  orderItems: IPaymentItem[];
}

export interface ISalesOverTimeEntry {
  hour: string; // e.g. "10", "14"
  totalAmount: number;
}

export interface ITopSellingItemEntry {
  itemId: number;
  itemName: string;
  unitPrice: number;
  quantity: number;
}

export interface ISalesByCategoryEntry {
  category: string;
  quantity: number;
}

export interface IOrdersPerUserEntry {
  userId: number;
  userName: string;
  orderCount: number;
}

export interface IPaymentStatsResponse {
  date: string;
  salesOverTime: ISalesOverTimeEntry[];
  topSellingItems: ITopSellingItemEntry[];
  salesByCategory: ISalesByCategoryEntry[];
  ordersPerUser: IOrdersPerUserEntry[];
}

export interface IFinanceMostActiveUser {
  id: number;
  email: string;
  totalOrders: number;
}

export interface IFinanceSummary {
  totalRevenue: number;
  totalOrders: number;
  mostActiveUser: IFinanceMostActiveUser;
}

export interface IHourlyRevenueEntry {
  hour: string;
  amount: number;
}

export interface IFinanceTopItem {
  itemId: number;
  name: string;
  quantity: number;
  revenue: number;
}

export interface IFinanceStatsResponse {
  period: IFinancePeriod;
  summary: IFinanceSummary;
  hourlyRevenue: IHourlyRevenueEntry[];
  topSellingItems: IFinanceTopItem[];
}

export interface ITodayOrder {
  id: number;
  orderNumber: number;
  date: string;
  totalAmount: number;
  discount: number;
  userId: number;
}
