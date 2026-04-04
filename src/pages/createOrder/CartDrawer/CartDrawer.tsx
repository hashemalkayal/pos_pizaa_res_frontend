import { useState, type FC } from "react";
import { FaTimes, FaTrash } from "react-icons/fa";
import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
import { PaymentMethod } from "../CreateOrder";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import CustomerDropdown from "@/components/shared/CustomerDropdown";
import type { ICustomer } from "@/api/types/res";

type CartItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
  comment?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  updateQty: (
    itemId: number,
    type: "inc" | "dec" | "set",
    value?: number,
  ) => void;
  items: CartItem[];
  gotFromCustomer: string;
  setGotFromCustomer: React.Dispatch<React.SetStateAction<string>>;
  selectedItems: Record<number, number>;
  totalPrice: number;
  basePrice: number;
  returnAmount: number;
  discountPercent: number;
  discountAmount: number;
  isLoading: boolean;
  paymentMethod: PaymentMethod;
  promoCode: string;
  onSelectPaymentMethod: (method: PaymentMethod) => void;
  onCharge: () => void;
  onApplyPromoCode: () => void;
  promoCodeHandler: (promo: string) => void;
  onRemoveItem: (id: number) => void;
  customerName: string;
  customerNumber: string;
  deliveryLocation: string;
  deliveryTime: string;
  deliveryPrice: string;
  setCustomerName: React.Dispatch<React.SetStateAction<string>>;
  setCustomerNumber: React.Dispatch<React.SetStateAction<string>>;
  setDeliveryLocation: React.Dispatch<React.SetStateAction<string>>;
  setDeliveryTime: React.Dispatch<React.SetStateAction<string>>;
  setDeliveryPrice: React.Dispatch<React.SetStateAction<string>>;
  onUpdateItemComment: (itemId: number, comment: string) => void;
};

const CartDrawer: FC<Props> = ({
  open,
  onClose,
  onSelectPaymentMethod,
  items,
  onCharge,
  // updateQty,
  totalPrice,
  // selectedItems,
  // discountPercent,
  returnAmount,
  basePrice,
  paymentMethod,
  discountAmount,
  isLoading,
  promoCode,
  gotFromCustomer,
  setGotFromCustomer,
  onApplyPromoCode,
  promoCodeHandler,
  onRemoveItem,
  customerName,
  customerNumber,
  deliveryLocation,
  deliveryTime,
  deliveryPrice,
  setCustomerName,
  setCustomerNumber,
  setDeliveryLocation,
  setDeliveryTime,
  setDeliveryPrice,
  onUpdateItemComment,
}) => {
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<ICustomer | null>(
    null,
  );

  const handleCustomerSelect = (customer: ICustomer | null) => {
    setSelectedCustomer(customer);
    if (customer) {
      setCustomerName(customer.customerName);
      setCustomerNumber(customer.customerNumber);
    }
  };

  const handleManualEntryToggle = () => {
    setIsManualEntry(!isManualEntry);
    if (!isManualEntry) {
      setSelectedCustomer(null);
      setCustomerName("");
      setCustomerNumber("");
    }
  };
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-[9998] h-full"
          onClick={onClose}
        />
      )}
      <div
        className={`fixed top-0 right-0 w-full sm:w-[400px] h-full bg-light z-[9999] shadow-xl transform transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <h2 className="text-lg font-semibold text-dark">Cart</h2>
          <button onClick={onClose}>
            <FaTimes className="text-red-800" />
          </button>
        </div>

        <div
          style={{ height: "50vh" }}
          className="p-4 space-y-4 overflow-y-auto"
        >
          {items.length === 0 ? (
            <p className="text-sm text-gray-500">No items selected</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 text-sm text-dark bg-gray-50 rounded-md py-2 px-3"
              >
                <div className="flex justify-between items-center">
                  <div className="flex flex-col max-w-[180px]">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {item.quantity} × {item.name}
                    </h3>
                    <span className="text-md text-gray-600">
                      {item.price.toFixed(2)} JD each
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-md font-bold text-gray-800">
                      {item.price * item.quantity} JD
                    </span>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveItem(item.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <FaTrash className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Item Comment */}
                <Input
                  type="text"
                  placeholder="Special instructions (e.g., Extra cheese)"
                  value={item.comment || ""}
                  onChange={(e) => onUpdateItemComment(item.id, e.target.value)}
                  className="text-xs"
                />
              </div>
            ))
          )}
        </div>

        <div
          className="flex flex-col gap-3 p-4 border-t border-gray-200 absolute bottom-0 w-full bg-white overflow-y-auto"
          style={{ maxHeight: "45vh" }}
        >
          {/* Customer Information Section */}
          <div className="space-y-2 pb-3 border-b">
            <h3 className="font-semibold text-sm text-gray-700">
              Customer Information
            </h3>

            <CustomerDropdown
              onSelect={handleCustomerSelect}
              selectedCustomer={selectedCustomer}
              onManualEntry={handleManualEntryToggle}
              isManualEntry={isManualEntry}
            />

            {isManualEntry && (
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Customer Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                <Input
                  type="tel"
                  placeholder="Phone Number (+962-xxx-xxxxxx)"
                  value={customerNumber}
                  onChange={(e) => setCustomerNumber(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Delivery Information Section */}
          <div className="space-y-2 pb-3 border-b">
            <h3 className="font-semibold text-sm text-gray-700">
              Delivery Information
            </h3>

            <Textarea
              placeholder="Delivery Location (Address)"
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
              className="min-h-[60px] text-sm"
            />

            <Input
              type="text"
              placeholder="Delivery Time (e.g., 7:00 PM)"
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
            />

            <div className="relative">
              <Input
                type="text"
                placeholder="Delivery Price"
                value={deliveryPrice}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || /^\d*\.?\d*$/.test(value)) {
                    setDeliveryPrice(value);
                  }
                }}
                className="pr-12"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none">
                JD
              </span>
            </div>
          </div>

          {/* Payment Method Section */}
          <div className="flex justify-center gap-4 pb-2">
            {[
              { type: PaymentMethod.CASH, label: "Cash", icon: "💵" },
              { type: PaymentMethod.VISA, label: "Visa", icon: "💳" },
              { type: PaymentMethod.CLIQ, label: "CliQ", icon: "📲" },
            ].map((method) => (
              <Button
                key={method.type}
                variant="outline"
                style={{ height: "fit-content", width: `calc(80% / 3)` }}
                onClick={() => onSelectPaymentMethod(method.type)}
                className={`flex flex-col items-center gap-1 text-xs px-3 py-2 ${
                  paymentMethod === method.type
                    ? "border-primary text-primary font-bold"
                    : "border-gray-300"
                }`}
              >
                <span className="text-lg">{method.icon}</span>
                {method.label}
              </Button>
            ))}
          </div>

          <div className="flex justify-between items-center gap-4">
            <div className="relative w-full">
              <Input
                value={promoCode}
                type="text"
                name="discount"
                placeholder="Enter discount"
                className="pr-8"
                onChange={(e) => {
                  const value = e.target.value;

                  if (value === "" || /^\d*\.?\d*$/.test(value))
                    promoCodeHandler(value);
                }}
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none">
                %
              </span>
            </div>

            <Button
              onClick={onApplyPromoCode}
              className="bg-primary text-dark hover:bg-primary/90"
            >
              Apply
            </Button>
          </div>

          <div className="flex flex-col gap-4 w-full">
            <div className="relative w-full">
              <Input
                value={gotFromCustomer}
                type="text"
                name="gotFromCustomer"
                placeholder="Got from customer (JD)"
                className="pr-12"
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || /^\d*\.?\d*$/.test(value)) {
                    setGotFromCustomer(value);
                  }
                }}
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none">
                JD
              </span>
            </div>

            <div className="flex justify-between text-sm font-medium">
              <span>Total Price:</span>
              <span>{totalPrice.toFixed(2)} JD</span>
            </div>

            <div className="flex justify-between text-sm font-medium">
              <span>Return to Customer:</span>
              <span
                className={returnAmount < 0 ? "text-red-500" : "text-green-600"}
              >
                {returnAmount >= 0
                  ? `${returnAmount.toFixed(2)} JD`
                  : "Insufficient"}
              </span>
            </div>
          </div>

          <div className="flex justify-between text-dark font-semibold">
            <span>Original Total</span>
            <span>{basePrice.toFixed(2)} JD</span>
          </div>
          <div className="flex justify-between text-dark font-semibold">
            <span>Total Discount</span>
            <span>{discountAmount.toFixed(2)} JD</span>
          </div>
          <div className="flex justify-between text-dark font-semibold text-lg border-t pt-2">
            <span>Total</span>
            <span>{totalPrice.toFixed(2)} JD</span>
          </div>

          <Button
            onClick={onCharge}
            disabled={items.length === 0 || isLoading}
            className="w-full bg-primary text-dark hover:bg-primary/90"
          >
            Charge
          </Button>
        </div>
      </div>
    </>
  );
};

export default CartDrawer;
