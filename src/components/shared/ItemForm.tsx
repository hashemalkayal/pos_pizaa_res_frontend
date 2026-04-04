import { useState, useEffect, type FC } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FaSave } from "react-icons/fa";

type ItemFormProps = {
  mode: "create" | "edit";
  categoryId: number;
  initialData?: {
    name: string;
    price: number;
    ingredients: string;
  };
  onSubmit: (data: {
    name: string;
    price: number;
    ingredients: string;
    categoryId: number;
  }) => void;
};

const ItemForm: FC<ItemFormProps> = ({
  mode,
  categoryId,
  initialData,
  onSubmit,
}) => {
  const [name, setName] = useState(initialData?.name || "");
  const [price, setPrice] = useState(initialData?.price || 0);
  const [ingredients, setIngredients] = useState(
    initialData?.ingredients || ""
  );

  useEffect(() => {
    if (mode === "edit" && initialData) {
      setName(initialData.name);
      setPrice(initialData.price);
      setIngredients(initialData.ingredients || "");
    }
  }, [mode, initialData]);

  const handleSubmit = () => {
    onSubmit({
      name,
      price,
      ingredients,
      categoryId,
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto bg-light text-dark border border-gray-200 shadow-md">
      <CardContent className="p-6 space-y-6">
        <h2 className="text-xl font-bold">
          {mode === "edit" ? "Edit Menu Item" : "Add New Menu Item"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 w-full">
            <Label
              htmlFor="item-name"
              className="text-sm font-medium text-dark"
            >
              Item Name
            </Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white border-gray-300"
              placeholder="e.g. Pepperoni Pizza"
            />
          </div>

          <div className="space-y-2 w-full">
            <Label htmlFor="price" className="text-sm font-medium text-dark">
              Price (JD)
            </Label>
            <Input
              id="price"
              type="number"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value))}
              className="bg-white border-gray-300"
              placeholder="e.g. 5.99"
            />
          </div>
        </div>

        <div className="space-y-2 w-full">
          <Label
            htmlFor="ingredients"
            className="text-sm font-medium text-dark"
          >
            Ingredients (comma separated)
          </Label>
          <Textarea
            id="ingredients"
            rows={4}
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            className="bg-white border-gray-300"
            placeholder="e.g. Cheese, Tomato, Olives"
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button
            type="button"
            onClick={handleSubmit}
            className="bg-primary text-dark hover:bg-primary/90 flex items-center gap-2"
          >
            <FaSave className="w-4 h-4" />
            {mode === "edit" ? "Update Item" : "Create Item"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ItemForm;
