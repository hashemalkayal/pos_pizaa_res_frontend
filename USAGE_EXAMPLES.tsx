// Example: How to use the new integrated features in your POS system

import { useState } from "react";
import type { ICustomer } from "@/api/types/res";

// ============================================
// EXAMPLE 1: Using CustomerDropdown Component
// ============================================

function OrderFormExample() {
  const [selectedCustomer, setSelectedCustomer] = useState<ICustomer | null>(
    null,
  );
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerNumber, setCustomerNumber] = useState("");

  const handleCustomerSelect = (customer: ICustomer | null) => {
    setSelectedCustomer(customer);
    if (customer) {
      setCustomerName(customer.customerName);
      setCustomerNumber(customer.customerNumber);
    }
  };

  const handleManualToggle = () => {
    setIsManualEntry(!isManualEntry);
    if (!isManualEntry) {
      setSelectedCustomer(null);
      setCustomerName("");
      setCustomerNumber("");
    }
  };

  return (
    <div className="space-y-4">
      {/* Customer Selection */}
      <CustomerDropdown
        onSelect={handleCustomerSelect}
        selectedCustomer={selectedCustomer}
        onManualEntry={handleManualToggle}
        isManualEntry={isManualEntry}
      />

      {/* If manual entry is enabled, show input fields */}
      {isManualEntry && (
        <div className="space-y-2">
          <Input
            placeholder="Customer Name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          <Input
            placeholder="Phone Number"
            value={customerNumber}
            onChange={(e) => setCustomerNumber(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

// ============================================
// EXAMPLE 2: Complete Order Payload
// ============================================

function createOrderPayloadExample() {
  // This is what gets sent to POST /api/item/charge
  const orderPayload = {
    items: [
      {
        itemId: 1,
        quantity: 2,
        comment: "Extra cheese, well done", // Item-level comment
      },
      {
        itemId: 5,
        quantity: 1,
        comment: "No onions", // Another item comment
      },
    ],
    discount: 10, // 10% discount
    paymentMethod: "CASH", // or "VISA" or "CLIQ"

    // Customer information (optional)
    customerName: "Ahmad Mohammed",
    customerNumber: "+962-777-123456",

    // Delivery information (optional)
    deliveryLocation: "Downtown, Street 15, Building 3, Apt 5",
    deliveryTime: "7:00 PM",
    deliveryPrice: 2.5,
  };

  return orderPayload;
}

// ============================================
// EXAMPLE 3: Customer API Response
// ============================================

// When you call GET /api/customer/all, you get:
const customerListExample = [
  {
    id: 1,
    customerName: "Ahmad Mohammed",
    customerNumber: "+962-777-123456",
    createdAt: "2026-04-01T10:30:00.000Z",
    _count: {
      orders: 15, // Number of orders this customer has made
    },
  },
  {
    id: 2,
    customerName: "Sara Ali",
    customerNumber: "+962-798-654321",
    createdAt: "2026-04-02T14:20:00.000Z",
    _count: {
      orders: 8,
    },
  },
];

// ============================================
// EXAMPLE 4: Item with Comment in Cart
// ============================================

function CartItemWithCommentExample() {
  const [comment, setComment] = useState("");

  return (
    <div className="cart-item">
      <div className="item-info">
        <h3>2 × Margherita Pizza</h3>
        <p>10.00 JD each</p>
      </div>

      {/* Special instructions for this specific item */}
      <Input
        placeholder="Special instructions (e.g., Extra cheese)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <div className="item-total">20.00 JD</div>
    </div>
  );
}

// ============================================
// EXAMPLE 5: Delivery Information Form
// ============================================

function DeliveryFormExample() {
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [deliveryPrice, setDeliveryPrice] = useState("");

  return (
    <div className="delivery-section space-y-2">
      <h3>Delivery Information</h3>

      <Textarea
        placeholder="Delivery Location (Full Address)"
        value={deliveryLocation}
        onChange={(e) => setDeliveryLocation(e.target.value)}
        className="min-h-[60px]"
      />

      <Input
        placeholder="Delivery Time (e.g., 7:00 PM)"
        value={deliveryTime}
        onChange={(e) => setDeliveryTime(e.target.value)}
      />

      <div className="relative">
        <Input
          placeholder="Delivery Price"
          value={deliveryPrice}
          onChange={(e) => {
            const value = e.target.value;
            // Only allow numbers and decimal points
            if (value === "" || /^\d*\.?\d*$/.test(value)) {
              setDeliveryPrice(value);
            }
          }}
        />
        <span className="absolute right-3 top-1/2 transform -translate-y-1/2">
          JD
        </span>
      </div>
    </div>
  );
}

// ============================================
// EXAMPLE 6: Full Order Charge Function
// ============================================

async function chargeOrderExample() {
  const items = [
    { itemId: 1, quantity: 2, comment: "Extra cheese" },
    { itemId: 5, quantity: 1, comment: "" },
  ];

  const orderData = {
    items,
    discount: 10,
    paymentMethod: "CASH",
    customerName: "Ahmad Mohammed",
    customerNumber: "+962-777-123456",
    deliveryLocation: "Downtown, Street 15",
    deliveryTime: "7:00 PM",
    deliveryPrice: 2.5,
  };

  try {
    const response = await fetch("/api/item/charge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${yourAuthToken}`,
      },
      body: JSON.stringify(orderData),
    });

    const result = await response.json();

    if (result.success) {
      console.log("Order created successfully:", result.data);
      // Order response includes:
      // - orderNumber
      // - customer info
      // - delivery info
      // - orderItems with comments
    }
  } catch (error) {
    console.error("Failed to create order:", error);
  }
}

// ============================================
// EXAMPLE 7: Managing Item Comments State
// ============================================

function ItemCommentsStateExample() {
  // Store comments as a map: itemId -> comment
  const [itemComments, setItemComments] = useState<Record<number, string>>({});

  const updateItemComment = (itemId: number, comment: string) => {
    setItemComments((prev) => ({
      ...prev,
      [itemId]: comment,
    }));
  };

  const getItemsWithComments = () => {
    return items.map((item) => ({
      itemId: item.id,
      quantity: item.quantity,
      comment: itemComments[item.id] || undefined, // Only include if exists
    }));
  };

  return {
    itemComments,
    updateItemComment,
    getItemsWithComments,
  };
}

// ============================================
// EXAMPLE 8: Customer Search/Filter Logic
// ============================================

function CustomerSearchExample() {
  const [customers, setCustomers] = useState<ICustomer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter customers by name or phone number
  const filteredCustomers = customers.filter(
    (customer) =>
      customer.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.customerNumber.includes(searchTerm),
  );

  return (
    <div>
      <input
        placeholder="Search customers..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="customer-list">
        {filteredCustomers.map((customer) => (
          <div key={customer.id} className="customer-item">
            <div>{customer.customerName}</div>
            <div className="text-gray-600">
              {customer.customerNumber} • {customer._count.orders} orders
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export {
  OrderFormExample,
  createOrderPayloadExample,
  customerListExample,
  CartItemWithCommentExample,
  DeliveryFormExample,
  chargeOrderExample,
  ItemCommentsStateExample,
  CustomerSearchExample,
};
