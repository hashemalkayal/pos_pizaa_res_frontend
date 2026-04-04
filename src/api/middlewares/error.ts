import { AxiosError } from "axios";
import { toast } from "react-toastify";

export const extractError = (error: AxiosError<any>): string => {
  let err: string = "";

  console.log("error", error.response?.data.validator);

  console.log("error.response?.data", error.response?.data);

  if (error.response?.data.validator) {
    for (const key in error.response?.data.validator) {
      err = error.response?.data.validator[key];

      break;
    }

    return Array.isArray(err) ? err[0] : err || "";
  }

  if (error.response?.data.message) return error.response?.data.message;

  return "";
};

export const axiosErrorHandling = (
  statusCode: number,
  error: AxiosError<any>
) => {
  switch (statusCode) {
    case 422: {
      return toast.error(extractError(error));
    }

    // case 401: {
    // }

    case 500: {
      return toast.error("server error");
    }

    default:
      return toast.error(extractError(error));
  }
};
