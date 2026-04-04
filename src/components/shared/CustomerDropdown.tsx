import { useEffect, useState, type FC } from "react";
import { useQueryWithAxios } from "@/api/hooks";
import type { ICustomer } from "@/api/types/res";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  onSelect: (customer: ICustomer | null) => void;
  selectedCustomer: ICustomer | null;
  onManualEntry: () => void;
  isManualEntry: boolean;
}

const CustomerDropdown: FC<Props> = ({
  onSelect,
  selectedCustomer,
  onManualEntry,
  isManualEntry,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [customers, setCustomers] = useState<ICustomer[]>([]);

  const { data, isPending } = useQueryWithAxios("customer", "getAll");

  useEffect(() => {
    if (data?.data?.response) {
      setCustomers(data.data.response);
    }
  }, [data]);

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.customerNumber.includes(searchTerm),
  );

  const handleCustomerSelect = (customer: ICustomer) => {
    onSelect(customer);
    setSearchTerm(`${customer.customerName} - ${customer.customerNumber}`);
    setShowDropdown(false);
  };

  const handleInputFocus = () => {
    if (!isManualEntry) {
      setShowDropdown(true);
    }
  };

  const handleInputChange = (value: string) => {
    setSearchTerm(value);
    if (!isManualEntry) {
      setShowDropdown(true);
      if (!value) {
        onSelect(null);
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <Input
            type="text"
            placeholder={
              isManualEntry
                ? "Enter new customer name and phone"
                : "Search existing customer..."
            }
            value={isManualEntry ? "" : searchTerm}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={handleInputFocus}
            disabled={isManualEntry || isPending}
            className="w-full"
          />

          {showDropdown && !isManualEntry && filteredCustomers.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => handleCustomerSelect(customer)}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                >
                  <div className="font-medium text-sm">
                    {customer.customerName}
                  </div>
                  <div className="text-xs text-gray-600">
                    {customer.customerNumber} • {customer._count.orders} orders
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          type="button"
          variant={isManualEntry ? "default" : "outline"}
          onClick={() => {
            onManualEntry();
            setSearchTerm("");
            setShowDropdown(false);
            onSelect(null);
          }}
          className="whitespace-nowrap"
        >
          {isManualEntry ? "Use Existing" : "New Customer"}
        </Button>
      </div>

      {selectedCustomer && !isManualEntry && (
        <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
          Selected: {selectedCustomer.customerName} -{" "}
          {selectedCustomer.customerNumber}
        </div>
      )}
    </div>
  );
};

export default CustomerDropdown;
