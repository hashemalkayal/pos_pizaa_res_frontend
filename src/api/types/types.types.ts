import type { AxiosResponse } from "axios";
import type {
  ICalculateItemPayload,
  IChargeItemPayload,
  ICreateItemPayload,
  IEditItemPayload,
  IFinanceQuery,
  ILoginPayload,
  IPaymentInfoQuery,
} from "./req";
import type {
  ICalculateItemResponse,
  ICategoryWithItems,
  IChargeItemResponse,
  ICreateItemResponse,
  IDeleteItemResponse,
  IFinanceStatsResponse,
  ILoginResponse,
  IPaymentInfo,
  IPaymentStatsResponse,
  ITodayOrder,
} from "./res";

export interface IAxiosResponse<T = any> extends Promise<AxiosResponse<T>> {}

export interface IAxiosData<T = any> {
  response: T;
  message: string;
}

export interface IAuthRoute {
  login: (payload: ILoginPayload) => IAxiosResponse<IAxiosData<ILoginResponse>>;
}

export interface IItemRoute {
  getAll: () => IAxiosResponse<IAxiosData<ICategoryWithItems[]>>;
  create: (
    payload: ICreateItemPayload
  ) => IAxiosResponse<IAxiosData<ICreateItemResponse>>;

  calculate: (
    payload: ICalculateItemPayload
  ) => IAxiosResponse<IAxiosData<ICalculateItemResponse>>;

  edit: (
    payload: IEditItemPayload
  ) => IAxiosResponse<IAxiosData<ICreateItemResponse>>;

  delete: (id: number) => IAxiosResponse<IAxiosData<IDeleteItemResponse>>;

  charge: (
    payload: IChargeItemPayload
  ) => IAxiosResponse<IAxiosData<IChargeItemResponse>>;

  getTodayOrders: () => IAxiosResponse<IAxiosData<ITodayOrder[]>>;
  deleteTodayOrder: (id: number) => IAxiosResponse<IAxiosData<{}>>;
  printTodayOrder: (id: number) => IAxiosResponse<IAxiosData<{}>>;
}

export interface IPaymentRoute {
  getInfo: (
    query?: IPaymentInfoQuery
  ) => IAxiosResponse<IAxiosData<IPaymentInfo[]>>;

  getStats: () => IAxiosResponse<IAxiosData<IPaymentStatsResponse>>;

  getFinance: (
    query?: IFinanceQuery
  ) => IAxiosResponse<IAxiosData<IFinanceStatsResponse>>;
}

export interface IAxiosRoute {
  auth: IAuthRoute;
  item: IItemRoute;
  payment: IPaymentRoute;
}
