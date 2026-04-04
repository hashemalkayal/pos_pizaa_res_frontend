// CreateOrder.tsx

import { useEffect, useState, type FC } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
import CartDrawer from "./CartDrawer/CartDrawer";
import { useMutationWithAxios, useQueryWithAxios } from "@/api/hooks";
import type { ICategoryWithItems } from "@/api/types/res";
import LoaderOverlay from "@/components/shared/LoaderOverlay";
import type { IItemsPayloadPayment } from "@/api/types/req";
import { toast } from "react-toastify";

export enum PaymentMethod {
  CASH = "CASH",
  VISA = "VISA",
  CLIQ = "CLIQ",
}

const CreateOrder: FC = () => {
  const [categories, setCategories] = useState<ICategoryWithItems[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>(
    {},
  );
  const [itemComments, setItemComments] = useState<Record<number, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    PaymentMethod.CASH,
  );
  const [gotFromCustomer, setGotFromCustomer] = useState<string>("");
  const [applyed, setApplyed] = useState(false);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [promoCode, setPromoCode] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Customer information
  const [customerName, setCustomerName] = useState<string>("");
  const [customerNumber, setCustomerNumber] = useState<string>("");

  // Delivery information
  const [deliveryLocation, setDeliveryLocation] = useState<string>("");
  const [deliveryTime, setDeliveryTime] = useState<string>("");
  const [deliveryPrice, setDeliveryPrice] = useState<string>("");

  const returnAmount = parseFloat(gotFromCustomer || "0") - totalPrice || 0;

  const { data, isPending: isPendingGetAll } = useQueryWithAxios(
    "item",
    "getAll",
  );
  const { mutateAsync: calculateMutateAsync, isPending } = useMutationWithAxios(
    "item",
    "calculate",
  );
  const { mutateAsync: chargeMutateAsync, isPending: chargeIsPending } =
    useMutationWithAxios("item", "charge");

  const getSelectedItemPayload = (): IItemsPayloadPayment[] =>
    Object.entries(selectedItems)
      .map(([key, quantity]) => ({
        itemId: Number(key),
        quantity,
        comment: itemComments[Number(key)] || undefined,
      }))
      .filter(
        ({ itemId, quantity }) =>
          Number.isFinite(itemId) && itemId > 0 && quantity > 0,
      );

  const closeDrawerHnadler = () => {
    setDrawerOpen(false);
    setPromoCode("");
  };

  const updateItemComment = (itemId: number, comment: string) => {
    setItemComments((prev) => ({
      ...prev,
      [itemId]: comment,
    }));
  };

  const onSelectPaymentMethod = (method: PaymentMethod) => {
    setPaymentMethod(method);
  };

  const promoCodeHandler = (value: string) => {
    setPromoCode(value);
  };

  const applyPromoCode = () => {
    if (getSelectedItemPayload()?.length > 0) setApplyed(true);
  };

  useEffect(() => {
    if (drawerOpen || (applyed && Number(promoCode) > 0)) {
      const items = getSelectedItemPayload();
      if (!!items?.length)
        calculateMutateAsync(
          { items, discount: Number(promoCode) },
          {
            onSuccess: (res) => {
              setApplyed(false);
              setBasePrice(res.data.response.baseTotal);
              setTotalPrice(res.data.response.total);
              setDiscountAmount(res.data.response.discountAmount);
              setDiscountPercent(res.data.response.discountPercent);
            },
            onError: () => window.location.reload(),
          },
        );
    }
  }, [drawerOpen, applyed]);

  useEffect(() => {
    if (!!data?.data.response?.length) setCategories(data.data.response);
  }, [data?.data.response]);

  const updateQty = (
    itemId: number,
    type: "inc" | "dec" | "set",
    value?: number,
  ) => {
    setSelectedItems((prev) => {
      const currentQty = prev[itemId] || 0;
      let newQty = currentQty;
      if (type === "inc") newQty = currentQty + 1;
      if (type === "dec") newQty = Math.max(currentQty - 1, 0);
      if (type === "set" && typeof value === "number")
        newQty = Math.max(value, 0);

      return { ...prev, [itemId]: newQty };
    });
  };

  const removeFromCart = async (id: number) => {
    const tempItems = { ...selectedItems };

    delete tempItems[id];

    const item = Object.entries(tempItems)
      .map(([key, quantity]) => ({ itemId: Number(key), quantity }))
      .filter(
        ({ itemId, quantity }) =>
          Number.isFinite(itemId) && itemId > 0 && quantity > 0,
      );

    await calculateMutateAsync(
      { items: item, discount: Number(promoCode) },
      {
        onSuccess: (res) => {
          setApplyed(false);
          setBasePrice(res.data.response.baseTotal);
          setTotalPrice(res.data.response.total);
          setDiscountAmount(res.data.response.discountAmount);
          setDiscountPercent(res.data.response.discountPercent);

          setSelectedItems(tempItems);
        },
        onError: () => window.location.reload(),
      },
    );
  };

  const cartItems = categories
    .flatMap((cat) => cat.items)
    .filter((item) => selectedItems[item.id] > 0)
    .map((item) => ({
      ...item,
      quantity: selectedItems[item.id],
      comment: itemComments[item.id] || "",
    }));

  const onChargeClick = async () => {
    const items = getSelectedItemPayload();
    const payload: any = {
      items,
      discount: +promoCode,
      paymentMethod,
    };

    // Add customer info if provided
    if (customerName) payload.customerName = customerName;
    if (customerNumber) payload.customerNumber = customerNumber;

    // Add delivery info if provided
    if (deliveryLocation) payload.deliveryLocation = deliveryLocation;
    if (deliveryTime) payload.deliveryTime = deliveryTime;
    if (deliveryPrice) payload.deliveryPrice = parseFloat(deliveryPrice);

    await chargeMutateAsync(payload, {
      onSuccess: (res) => {
        toast.success(res.data.message);
        // Reset all form fields
        setPromoCode("");
        setSelectedItems({});
        setItemComments({});
        setTotalPrice(0);
        setBasePrice(0);
        setDiscountAmount(0);
        setDiscountPercent(0);
        setApplyed(false);
        setDrawerOpen(false);
        setCustomerName("");
        setCustomerNumber("");
        setDeliveryLocation("");
        setDeliveryTime("");
        setDeliveryPrice("");
        setGotFromCustomer("");
      },
    });
  };

  const orderedCategories = [
    ...categories.filter((c) => c.category.id === 1),
    ...categories.filter((c) => c.category.id === 8),
    ...categories.filter((c) => c.category.id !== 1 && c.category.id !== 8),
  ];

  return (
    <>
      <LoaderOverlay show={isPendingGetAll || isPending || chargeIsPending} />

      <div className="space-y-8 relative">
        <div className="sticky top-[-20px] z-40 bg-white py-3 flex justify-end px-4">
          <Button
            onClick={() => setDrawerOpen(true)}
            className="bg-primary text-dark shadow-lg px-6 py-3 rounded-full"
          >
            🛒 View Cart ({cartItems.length})
          </Button>
        </div>

        {orderedCategories.map((cat) => (
          <div
            key={cat.category.id}
            className="rounded-xl border border-gray-200 shadow-sm bg-white p-6 space-y-6"
          >
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h2 className="text-lg font-semibold text-dark">
                {cat.category.name}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {cat.items.map((item) => {
                const qty = selectedItems[item.id] || 0;
                return (
                  <Card
                    key={item.id}
                    className="border border-gray-200 rounded-lg hover:shadow-md transition p-0"
                  >
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-md text-foreground group-hover:text-primary transition-colors">
                          {item.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.ingredients?.join(", ")}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <p className="text-base font-bold text-gray-900">
                          {item.price.toFixed(2)} JD
                        </p>

                        <div className=" flex items-center gap-2">
                          {qty > 0 && (
                            <Button
                              onClick={() => updateQty(item.id, "dec")}
                              className="h-8 w-8 rounded-full border border-gray-300 text-lg bg-yellow-500 hover:bg-yellow-600"
                            >
                              -
                            </Button>
                          )}
                          {qty > 0 ? (
                            <span className="text-md font-bold text-black px-2">
                              {qty}
                            </span>
                          ) : (
                            <span />
                          )}
                          <Button
                            onClick={() => updateQty(item.id, "inc")}
                            className="h-8 w-8 rounded-full border border-gray-300 text-lg bg-yellow-500 hover:bg-yellow-600"
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}

        <CartDrawer
          isLoading={chargeIsPending || isPending}
          open={drawerOpen}
          updateQty={updateQty}
          selectedItems={selectedItems}
          onApplyPromoCode={applyPromoCode}
          onSelectPaymentMethod={onSelectPaymentMethod}
          totalPrice={totalPrice}
          paymentMethod={paymentMethod}
          basePrice={basePrice}
          gotFromCustomer={gotFromCustomer}
          setGotFromCustomer={setGotFromCustomer}
          returnAmount={returnAmount}
          discountPercent={discountPercent}
          discountAmount={discountAmount}
          promoCode={promoCode}
          onClose={closeDrawerHnadler}
          promoCodeHandler={promoCodeHandler}
          items={cartItems}
          onCharge={onChargeClick}
          onRemoveItem={removeFromCart}
          customerName={customerName}
          customerNumber={customerNumber}
          deliveryLocation={deliveryLocation}
          deliveryTime={deliveryTime}
          deliveryPrice={deliveryPrice}
          setCustomerName={setCustomerName}
          setCustomerNumber={setCustomerNumber}
          setDeliveryLocation={setDeliveryLocation}
          setDeliveryTime={setDeliveryTime}
          setDeliveryPrice={setDeliveryPrice}
          onUpdateItemComment={updateItemComment}
        />
      </div>
    </>
  );
};

export default CreateOrder;
