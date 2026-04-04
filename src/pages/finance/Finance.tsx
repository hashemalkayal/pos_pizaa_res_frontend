import { useState, type FC } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useQueryWithAxios } from "@/api/hooks";
import LoaderOverlay from "@/components/shared/LoaderOverlay";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { IFinanceStatsResponse } from "@/api/types/res";
import { format, parseISO } from "date-fns";

const Finance: FC = () => {
  const [range, setRange] = useState<"daily" | "weekly" | "monthly">("daily");

  const { data, isPending } = useQueryWithAxios("payment", "getFinance", {
    period: range,
  });

  const response = data?.data.response || ({} as IFinanceStatsResponse);

  const temp =
    response?.hourlyRevenue?.map((el) => {
      return {
        ...el,
        hour: format(parseISO(el.hour), "hh:mm a"),
      };
    }) || [];

  return (
    <div className="space-y-6">
      <LoaderOverlay show={isPending} />

      {/* Header + Tabs */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-dark">Finance Overview</h1>
        <Tabs value={range} onValueChange={(val) => setRange(val as any)}>
          <TabsList className="w-full sm:w-auto justify-between">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4 text-dark">
            Revenue by Hour
          </h2>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={temp || []}>
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="amount" fill="#f7ca27" name="Total Amount" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top Selling Items */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4 text-dark">
            Top Selling Items
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {response?.topSellingItems?.map((item: any) => (
              <div
                key={item.itemId}
                className="border p-4 rounded-lg bg-white shadow-sm space-y-1"
              >
                <p className="font-bold text-dark">{item.name}</p>
                <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                <p className="text-sm text-gray-600">
                  Revenue: {item.revenue.toFixed(2)} JD
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Admin Summary */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4 text-dark">Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 border rounded shadow-sm">
              <p className="text-gray-600 text-sm">Total Revenue</p>
              <p className="text-xl font-bold text-dark">
                {response?.summary?.totalRevenue?.toFixed(2)} JD
              </p>
            </div>

            <div className="bg-white p-4 border rounded shadow-sm">
              <p className="text-gray-600 text-sm">Total Orders</p>
              <p className="text-xl font-bold text-dark">
                {response?.summary?.totalOrders || 0}
              </p>
            </div>

            <div className="bg-white p-4 border rounded shadow-sm">
              <p className="text-gray-600 text-sm">Most Active User</p>
              <p className="text-xl font-bold text-dark">
                {response?.summary?.mostActiveUser?.email || "-"}
              </p>
              <p className="text-sm text-gray-500">
                {response?.summary?.mostActiveUser?.totalOrders || 0} orders
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Finance;
