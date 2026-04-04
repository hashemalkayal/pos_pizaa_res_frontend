import type { FC } from "react";
import { useQueryWithAxios } from "@/api/hooks";
import { Card, CardBody, Typography } from "@material-tailwind/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import LoaderOverlay from "@/components/shared/LoaderOverlay";
import type { IPaymentStatsResponse } from "@/api/types/res";

const Home: FC = () => {
  const { data, isPending } = useQueryWithAxios("payment", "getStats");

  const stats: IPaymentStatsResponse | null =
    data?.data.response || ({} as IPaymentStatsResponse);

  const salesOverTime =
    stats?.salesOverTime?.map((item) => ({
      hour: `${item.hour}:00`,
      totalAmount: item.totalAmount,
    })) || [];

  const topSellingItems =
    stats?.topSellingItems?.map((item) => ({
      name: item.itemName,
      quantity: item.quantity,
    })) || [];

  const ordersPerUser =
    stats?.ordersPerUser?.map((user) => ({
      user: user.userName,
      orders: user.orderCount,
    })) || [];

  return (
    <>
      <LoaderOverlay show={isPending} />
      <div className="space-y-6">
        {/* Sales Over Time */}
        <Card className="p-4 sm:p-6">
          <CardBody className="p-0">
            <Typography
              variant="h6"
              className="mb-4 text-dark text-lg sm:text-xl"
            >
              Sales Over Time (Hourly)
            </Typography>
            <div className="w-full h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesOverTime}>
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="totalAmount" fill="#facc15" name="Total JD" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        {/* Top Selling Items */}
        <Card className="p-4 sm:p-6">
          <CardBody className="p-0">
            <Typography
              variant="h6"
              className="mb-4 text-dark text-lg sm:text-xl"
            >
              Top Selling Items
            </Typography>
            <div className="w-full h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSellingItems}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="quantity" fill="#4ade80" name="Qty Sold" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        {/* Orders Per User */}
        <Card className="p-4 sm:p-6">
          <CardBody className="p-0">
            <Typography
              variant="h6"
              className="mb-4 text-dark text-lg sm:text-xl"
            >
              Orders Per User
            </Typography>
            <div className="w-full h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ordersPerUser}>
                  <XAxis dataKey="user" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="orders" fill="#60a5fa" name="Order Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
};

export default Home;
