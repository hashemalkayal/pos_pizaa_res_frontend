import type { FC } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FaEdit } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useQueryWithAxios } from "../../api/hooks";
// import { toast } from "react-toastify";
import LoaderOverlay from "@/components/shared/LoaderOverlay";

const Categories: FC = () => {
  const navigate = useNavigate();

  const {
    data,
    // refetch,
    isPending: isPendingGetAll,
  } = useQueryWithAxios("item", "getAll");

  // const { mutateAsync, isPending } = useMutationWithAxios("item", "delete");

  const categories = data?.data.response || [];

  const onAddItemPress = (categoryId: number) => {
    navigate("/categories/categories-add", { state: { categoryId } });
  };

  const onEditItemPress = (payload: any) => {
    navigate("/categories/categories-edit", { state: { payload } });
  };

  // const onDeletePress = async (id: number) => {
  //   await mutateAsync(id, {
  //     onSuccess: (res) => {
  //       toast.success(res.data.message);
  //       refetch();
  //     },
  //   });
  // };

  return (
    <>
      <LoaderOverlay show={isPendingGetAll} />

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

                    <div className="flex flex-wrap justify-end gap-2 mt-4">
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
                        className="bg-primary text-dark hover:opacity-90 flex items-center gap-2"
                      >
                        <FaEdit className="w-4 h-4" />
                        Edit
                      </Button>

                      {/* <Button
                        disabled={isPending}
                        onClick={() => onDeletePress(item.id)}
                        size="sm"
                        className="bg-red-600 text-white hover:bg-red-700 flex items-center gap-2"
                      >
                        <FaTrash className="w-4 h-4" />
                        Delete
                      </Button> */}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default Categories;
