import { PaymentMethod } from "@/pages/createOrder/CreateOrder";

export interface ILoginPayload {
  email: string;
  password: string;
}

export interface ICreateItemPayload {
  name: string;
  price: string;
  ingredients?: string;
  categoryId: string;
}

export interface IItemsPayloadPayment {
  itemId: number;
  quantity: number;
}

export interface ICalculateItemPayload {
  items: IItemsPayloadPayment[];
  discount?: number;
}

export interface IEditItemPayload extends ICreateItemPayload {
  id: number;
}

export interface IChargeItemPayload {
  items: IItemsPayloadPayment[];
  paymentMethod: PaymentMethod;
  discount?: number;
}

export interface IPaymentInfoQuery {
  start?: string;
  end?: string;
}

export type IFinancePeriod = "daily" | "weekly" | "monthly";

export interface IFinanceQuery {
  period?: IFinancePeriod;
}
