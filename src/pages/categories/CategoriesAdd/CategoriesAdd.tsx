import type { FC } from "react";
import ItemForm from "../../../components/shared/ItemForm";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutationWithAxios } from "../../../api/hooks";
import { toast } from "react-toastify";
import LoaderOverlay from "@/components/shared/LoaderOverlay";

const CategoriesAdd: FC = () => {
  const state: { categoryId: number } = useLocation()?.state || {
    categoryId: 0,
  };

  const { mutateAsync, isPending } = useMutationWithAxios("item", "create");

  const navigate = useNavigate();

  const onSubmit = async (item: any) => {
    await mutateAsync(
      {
        categoryId: String(state?.categoryId) || "",
        name: item.name,
        price: item.price,
        ingredients: item?.ingredients || "",
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
        mode="create"
        categoryId={state?.categoryId}
        onSubmit={onSubmit}
      />
    </>
  );
};

export default CategoriesAdd;
