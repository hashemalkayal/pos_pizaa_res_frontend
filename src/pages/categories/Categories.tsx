import type { FC } from "react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FaEdit, FaTrash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useQueryWithAxios, useMutationWithAxios } from "../../api/hooks";
import { toast } from "react-toastify";
import LoaderOverlay from "@/components/shared/LoaderOverlay";

const Categories: FC = () => {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const {
    data,
    refetch,
    isPending: isPendingGetAll,
  } = useQueryWithAxios("item", "getAll");

  const { mutateAsync, isPending } = useMutationWithAxios("item", "delete");

  const categories = data?.data.response || [];

  const onAddItemPress = (categoryId: number) => {
    navigate("/categories/categories-add", { state: { categoryId } });
  };

  const onEditItemPress = (payload: any) => {
    navigate("/categories/categories-edit", { state: { payload } });
  };

  const openDeleteDialog = (id: number, itemName: string) => {
    setItemToDelete({ id, name: itemName });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    await mutateAsync(itemToDelete.id, {
      onSuccess: (res) => {
        toast.success(res.data.message);
        refetch();
        setDeleteDialogOpen(false);
        setItemToDelete(null);
      },
    });
  };

  return (
    <>
      <LoaderOverlay show={isPendingGetAll || isPending} />

      <div className="space-y-10">
        <h1 className="text-2xl font-bold text-dark">Categories</h1>

        {categories.map((element, index) => (
          <div
            key={index}
            className="rounded-xl border border-gray-200 shadow-sm bg-white p-4 sm:p-6 space-y-6"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 gap-4">
              <h2 className="text-xl font-bold text-dark">
                {element.category.name}
              </h2>
              <Button
                onClick={() => onAddItemPress(element.category.id)}
                className="bg-primary text-dark hover:opacity-90"
                size="sm"
              >
                Add Item
              </Button>
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {element.items.map((item, idx) => (
                <Card
                  key={idx}
                  className="bg-gray-50 border shadow-sm hover:shadow-md transition rounded-lg h-full"
                >
                  <CardContent className="p-4 flex flex-col h-full justify-between">
                    <div>
                      <h3 className="text-md font-semibold text-dark">
                        {item.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {item.price.toFixed(2)} JD
                      </p>
                      {item.ingredients && (
                        <p className="text-xs text-gray-400 mt-1">
                          {item.ingredients.join(", ")}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      <Button
                        onClick={() =>
                          onEditItemPress({
                            categoryId: element.category.id,
                            price: item.price,
                            name: item.name,
                            id: item.id,
                            ingredients: item?.ingredients || "",
                          })
                        }
                        size="sm"
                        variant="outline"
                        className="flex-1 flex items-center justify-center gap-2"
                      >
                        <FaEdit className="w-3 h-3" />
                        Edit
                      </Button>

                      <Button
                        disabled={isPending}
                        onClick={() => openDeleteDialog(item.id, item.name)}
                        size="sm"
                        variant="destructive"
                        className="flex-1 flex items-center justify-center gap-2"
                      >
                        <FaTrash className="w-3 h-3" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>"{itemToDelete?.name}"</strong>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Categories;
