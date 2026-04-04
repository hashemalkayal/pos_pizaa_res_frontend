import { type FC } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ItemForm from "../../../components/shared/ItemForm";
import { useMutationWithAxios } from "../../../api/hooks";
import { toast } from "react-toastify";
import LoaderOverlay from "@/components/shared/LoaderOverlay";

const CategoriesEdit: FC = () => {
  const state = useLocation()?.state?.payload || {};

  const { mutateAsync, isPending } = useMutationWithAxios("item", "edit");

  const navigate = useNavigate();

  const onSubmit = async (item: any) => {
    console.log("item", item);

    const normalizedIngredients = Array.isArray(item?.ingredients)
      ? item.ingredients.join(",")
      : typeof item?.ingredients === "string"
      ? item.ingredients.replace(/\s+/g, ",")
      : "";

    await mutateAsync(
      {
        id: state.id,
        categoryId: String(state?.categoryId) || "",
        name: item.name,
        price: item.price,
        ingredients: normalizedIngredients,
      },
      {
        onSuccess: (res) => {
          toast.success(res.data.message);
          navigate(-1);
        },
      }
    );
  };

  return (
    <>
      <LoaderOverlay show={isPending} />

      <ItemForm
        mode="edit"
        categoryId={state.categoryId}
        onSubmit={onSubmit}
        initialData={{
          ingredients: state?.ingredients || "",
          name: state?.name,
          price: state?.price,
        }}
      />
    </>
  );
};

export default CategoriesEdit;
