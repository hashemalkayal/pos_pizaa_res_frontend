import { useQueryWithAxios, useMutationWithAxios } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import LoaderOverlay from "@/components/shared/LoaderOverlay";
import { FaTrash, FaPrint } from "react-icons/fa";
import { format } from "date-fns";
import type { FC } from "react";
import { toast } from "react-toastify";

const OrdersHistory: FC = () => {
  const { data, isPending, refetch } = useQueryWithAxios(
    "item",
    "getTodayOrders"
  );

  const { mutateAsync: deleteOrder, isPending: isDeleting } =
    useMutationWithAxios("item", "deleteTodayOrder");

  const { mutateAsync: printOrder, isPending: isPrinted } =
    useMutationWithAxios("item", "printTodayOrder");

  const orders = data?.data.response || [];

  const handleDelete = async (id: number) => {
    await deleteOrder(id, {
      onSuccess: (res) => {
        toast.success(res.data.message);
        refetch();
      },
    });
  };

  const handlePrint = async (id: number) => {
    await printOrder(id, {
      onSuccess: (res) => {
        toast.success(res.data.message);
      },
    });
  };

  const userRole = localStorage.getItem("role");

  return (
    <>
      <LoaderOverlay show={isPending || isDeleting || isPrinted} />

      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-dark">Orders History</h1>

        {orders.length === 0 ? (
          <p className="text-sm text-gray-500">No orders created today.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((order: any) => (
              <Card key={order.id} className="border border-gray-200 bg-white">
                <CardContent className="p-3 space-y-2">
                  <div>
                    <p className="font-semibold text-dark text-sm">
                      Order #{order.orderNumber}
                    </p>
                    <p className="text-xs text-gray-600">
                      {format(new Date(order.date), "PPP p")}
                    </p>

                    <p className="mt-1 text-base font-bold text-green-700">
                      Total: {order.totalAmount.toFixed(2)} JD
                    </p>

                    {order.discount > 0 && (
                      <p className="text-xs text-gray-500">
                        Discount: {order?.discount?.toFixed(2)} JD
                      </p>
                    )}

                    <ul className="mt-1 space-y-0.5 text-sm text-gray-700">
                      {order.orderItems.map((oi: any, idx: number) => (
                        <li key={idx}>
                          {oi.item?.name || "Unknown Item"} × {oi.quantity}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      onClick={() => handlePrint(order.id)}
                      className="bg-primary text-dark hover:opacity-90"
                      size="sm"
                    >
                      <FaPrint className="mr-2" /> Print
                    </Button>

                    {userRole === "ADMIN" && (
                      <Button
                        onClick={() => handleDelete(order.id)}
                        className="bg-red-600 text-white hover:bg-red-700"
                        size="sm"
                      >
                        <FaTrash className="mr-2" /> Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default OrdersHistory;
