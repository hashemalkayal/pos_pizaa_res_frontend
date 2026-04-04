import { useState, type FC } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FaFileExcel,
  FaFilePdf,
  FaRandom,
  FaProjectDiagram,
} from "react-icons/fa";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { useQueryWithAxios } from "@/api/hooks";
import LoaderOverlay from "@/components/shared/LoaderOverlay";

const Payments: FC = () => {
  const [fromDate, setFromDate] = useState<Date>(new Date());
  const [toDate, setToDate] = useState<Date>(new Date());
  const [showAs, setShowAs] = useState<"group" | "flat">("group");

  const { data, isPending } = useQueryWithAxios("payment", "getInfo", {
    start: format(fromDate, "yyyy-MM-dd"),
    end: format(toDate, "yyyy-MM-dd"),
  });

  const allPayments = data?.data.response || [];

  const exportToExcel = () => {
    const exportData: any[] = [];

    allPayments.forEach((p: any) => {
      p.orderItems.forEach((orderItem: any) => {
        if (orderItem.item) {
          exportData.push({
            "Order ID": `#${p.id}`,
            Date: format(parseISO(p.date), "yyyy-MM-dd HH:mm"),
            Item: orderItem.item.name,
            Price: orderItem.item.price,
            Quantity: orderItem.quantity,
            Total: (orderItem.item.price * orderItem.quantity).toFixed(2),
          });
        }
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payments");
    XLSX.writeFile(wb, "payments.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const body = allPayments.flatMap((p: any) =>
      p.orderItems
        .filter((item: any) => item.item)
        .map((item: any) => [
          `#${p.id}`,
          format(parseISO(p.date), "yyyy-MM-dd HH:mm"),
          item.item.name,
          item.item.price,
          item.quantity,
          (item.item.price * item.quantity).toFixed(2),
        ])
    );

    autoTable(doc, {
      head: [["Order ID", "Date", "Item", "Price", "Qty", "Total"]],
      body,
      margin: { top: 20 },
    });

    doc.save("payments.pdf");
  };

  const changeTableView = (type: "group" | "flat") => {
    setShowAs(type);
  };

  const totalAmount = allPayments.reduce(
    (sum: number, p: any) => sum + p.totalAmount,
    0
  );

  return (
    <>
      <LoaderOverlay show={isPending} />

      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-dark">Payments</h1>

        <Card className="bg-light border border-gray-200">
          <CardContent className="flex flex-col sm:flex-row flex-wrap justify-between items-start sm:items-center gap-4">
            {/* Date Pickers */}
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              {/* From */}
              <div className="flex flex-col text-sm w-full sm:w-auto">
                <label className="mb-1 text-dark">From</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "w-full sm:w-[200px] justify-start text-left font-normal bg-white border border-gray-300 rounded-md px-3 py-2 flex items-center gap-2",
                        !fromDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="h-4 w-4" />
                      {fromDate ? (
                        format(fromDate, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fromDate}
                      onSelect={(date) => setFromDate(date || new Date())}
                      initialFocus
                      toDate={new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* To */}
              <div className="flex flex-col text-sm w-full sm:w-auto">
                <label className="mb-1 text-dark">To</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "w-full sm:w-[200px] justify-start text-left font-normal bg-white border border-gray-300 rounded-md px-3 py-2 flex items-center gap-2",
                        !toDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="h-4 w-4" />
                      {toDate ? (
                        format(toDate, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={toDate}
                      onSelect={(date) => setToDate(date || new Date())}
                      initialFocus
                      fromDate={fromDate}
                      toDate={new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                onClick={exportToExcel}
                className="bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <FaFileExcel className="w-4 h-4" />
                Excel
              </Button>
              <Button
                onClick={exportToPDF}
                className="bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <FaFilePdf className="w-4 h-4" />
                PDF
              </Button>

              <Button
                onClick={() => changeTableView("group")}
                className="bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <FaRandom className="w-4 h-4" />
                Show Grouped
              </Button>

              <Button
                onClick={() => changeTableView("flat")}
                className="bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <FaProjectDiagram className="w-4 h-4" />
                Show Flat
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payments Table */}
        <Card className="overflow-auto border border-gray-200">
          <CardContent className="p-0 min-w-[500px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-700 border-b">
                <tr>
                  <th className="px-4 py-3">Order Number</th>
                  <th className="px-4 py-3">Payment Method</th>

                  <th className="px-4 py-3">Date</th>

                  {showAs === "flat" && (
                    <>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Quantity</th>
                    </>
                  )}

                  <th className="px-4 py-3">Amount</th>
                </tr>
              </thead>
              {showAs === "flat" ? (
                <tbody>
                  {allPayments.flatMap((p) =>
                    p.orderItems.map(
                      (item, i: number) =>
                        item.item && (
                          <tr
                            key={`${p.id}-${i}`}
                            className="border-b hover:bg-gray-50"
                          >
                            <td className="px-4 py-2">#{p.orderNumber}</td>
                            <td className="px-4 py-2">{p.paymentMethod}</td>
                            <td className="px-4 py-2">
                              {format(
                                parseISO(p.date as any),
                                "yyyy-MM-dd hh:mm a"
                              )}
                            </td>
                            <td className="px-4 py-2">{item.item.name}</td>
                            <td className="px-4 py-2">{item.quantity}</td>
                            <td className="px-4 py-2">
                              {(item.quantity * item.item.price).toFixed(2)} JD
                            </td>
                          </tr>
                        )
                    )
                  )}
                </tbody>
              ) : (
                <tbody>
                  {allPayments.map((p) => (
                    <tr key={`${p.id}`} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">#{p.orderNumber}</td>
                      <td className="px-4 py-2">{p.paymentMethod}</td>

                      <td className="px-4 py-2">
                        {format(parseISO(p.date as any), "yyyy-MM-dd hh:mm a")}
                      </td>

                      <td className="px-4 py-2">
                        {p.totalAmount.toFixed(2)} JD
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}

              <tfoot>
                <tr className="font-bold bg-gray-50 border-t">
                  <td className="px-4 py-2" colSpan={showAs === "flat" ? 5 : 3}>
                    Total
                  </td>
                  <td className="px-4 py-2">{totalAmount.toFixed(2)} JD</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Payments;
