import {
  IconBaguette,
  IconBottle,
  IconBowlSpoon,
  IconBread,
  IconChefHat,
  IconFlask,
  IconPizza,
  IconSalad,
  IconToolsKitchen2,
} from "@tabler/icons-react";

/** Placeholder art for products without a photo, by category (the catalog has no photos yet). */
export const categoryIcon = (category: { nameEn: string }) => {
  const name = category.nameEn.toLowerCase();
  if (name.includes("pizza")) return IconPizza;
  if (name.includes("pasta")) return IconBowlSpoon;
  if (name.includes("salad")) return IconSalad;
  if (name.includes("drink")) return IconBottle;
  if (name.includes("sandwich")) return IconBaguette;
  if (name.includes("manak") || name.includes("bread")) return IconBread;
  if (name.includes("lab")) return IconFlask;
  if (name.includes("staff")) return IconChefHat;
  return IconToolsKitchen2;
};
