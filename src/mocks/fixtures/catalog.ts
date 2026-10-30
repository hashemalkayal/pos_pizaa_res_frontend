import type {
  CatalogCategory,
  CatalogUnit,
  CatalogVariant,
} from "@/api/v2/catalog";

/**
 * DEVELOPMENT FIXTURE — never shown as live data. Shape of GET /api/catalog; names, SKUs and prices copied
 * from the approved catalog (backend docs/migration-planning/menu-catalog-proposal.json). Ids are
 * illustrative. A subset: pizza (sizes × doughs, add-ons), manakish (dough only), pasta (pasta type, add-on),
 * a folded sandwich and drinks (one unlabelled variant, no add-ons), plus the empty Staff Meal category (D71).
 */
const medium: CatalogUnit = {
  id: 1,
  code: "M",
  nameEn: "Medium",
  nameAr: "وسط",
  sortOrder: 1,
  isActive: true,
};
const large: CatalogUnit = {
  id: 2,
  code: "L",
  nameEn: "Large",
  nameAr: "كبير",
  sortOrder: 2,
  isActive: true,
};

const dough = {
  id: 1,
  code: "DOUGH",
  nameEn: "Dough Type",
  nameAr: "نوع العجينة",
  sortOrder: 1,
  values: [
    {
      id: 1,
      optionGroupId: 1,
      code: "REGULAR",
      nameEn: "Regular",
      nameAr: "عادية",
      sortOrder: 1,
      isActive: true,
    },
    {
      id: 2,
      optionGroupId: 1,
      code: "WHOLE_WHEAT",
      nameEn: "Whole Wheat",
      nameAr: "قمح كامل",
      sortOrder: 2,
      isActive: true,
    },
  ],
};

const pastaType = {
  id: 2,
  code: "PASTA_TYPE",
  nameEn: "Pasta Type",
  nameAr: "نوع الباستا",
  sortOrder: 2,
  values: [
    {
      id: 3,
      optionGroupId: 2,
      code: "REGULAR",
      nameEn: "Regular Penne",
      nameAr: "بيني عادي",
      sortOrder: 1,
      isActive: true,
    },
    {
      id: 4,
      optionGroupId: 2,
      code: "WHOLE_WHEAT",
      nameEn: "Whole Wheat Penne",
      nameAr: "بيني قمح كامل",
      sortOrder: 2,
      isActive: true,
    },
  ],
};

const variant = (
  fields: Omit<
    CatalogVariant,
    "isActive" | "isDefault" | "archived" | "archivedAt"
  >,
): CatalogVariant => ({
  ...fields,
  isActive: true,
  isDefault: false,
  archived: false,
  archivedAt: null,
});

const doughOption = (value: (typeof dough.values)[number]) => ({
  groupId: 1,
  group: "DOUGH",
  valueId: value.id,
  value: value.code,
  nameEn: value.nameEn,
  nameAr: value.nameAr,
});

const pastaOption = (value: (typeof pastaType.values)[number]) => ({
  groupId: 2,
  group: "PASTA_TYPE",
  valueId: value.id,
  value: value.code,
  nameEn: value.nameEn,
  nameAr: value.nameAr,
});

export const MOCK_CATALOG: CatalogCategory[] = [
  {
    id: 1,
    nameEn: "Pizza",
    nameAr: "بيتزا",
    imageUrl: null,
    sortOrder: 1,
    products: [
      {
        id: 1,
        slug: "pizza-margherita",
        nameEn: "Margherita",
        nameAr: "مارجريتا",
        descriptionEn: null,
        descriptionAr: null,
        imageUrl: null,
        usesUnits: true,
        optionGroups: [dough],
        variants: [
          variant({
            id: 101,
            productId: 1,
            sku: "PIZZA-MARGHERITA-M-REGULAR",
            unit: medium,
            options: [doughOption(dough.values[0])],
            labelEn: "Medium · Regular",
            labelAr: "وسط · عادية",
            price: "4.000",
            sortOrder: 1,
          }),
          variant({
            id: 102,
            productId: 1,
            sku: "PIZZA-MARGHERITA-L-REGULAR",
            unit: large,
            options: [doughOption(dough.values[0])],
            labelEn: "Large · Regular",
            labelAr: "كبير · عادية",
            price: "5.000",
            sortOrder: 2,
          }),
          variant({
            id: 103,
            productId: 1,
            sku: "PIZZA-MARGHERITA-M-WHOLE-WHEAT",
            unit: medium,
            options: [doughOption(dough.values[1])],
            labelEn: "Medium · Whole Wheat",
            labelAr: "وسط · قمح كامل",
            price: "5.000",
            sortOrder: 3,
          }),
        ],
        ingredients: [
          { id: 1, nameEn: "Tomato Sauce", nameAr: "صلصة طماطم" },
          { id: 2, nameEn: "Mozzarella", nameAr: "جبنة موزاريلا" },
          { id: 3, nameEn: "Basil", nameAr: "ريحان" },
        ],
        addOns: [
          {
            addOnId: 1,
            nameEn: "Extra Tomato Sauce",
            nameAr: "إضافة صلصة طماطم",
            price: "1.000",
          },
          {
            addOnId: 2,
            nameEn: "Extra Mozzarella",
            nameAr: "إضافة جبنة موزاريلا",
            price: "1.000",
          },
          {
            addOnId: 3,
            nameEn: "Extra Basil",
            nameAr: "إضافة ريحان",
            price: "1.000",
          },
        ],
      },
    ],
  },
  {
    id: 2,
    nameEn: "Manakish",
    nameAr: "مناقيش",
    imageUrl: null,
    sortOrder: 2,
    products: [
      {
        id: 18,
        slug: "manakish-zaatar",
        nameEn: "Za'atar",
        nameAr: "زعتر",
        descriptionEn: null,
        descriptionAr: null,
        imageUrl: null,
        usesUnits: false,
        optionGroups: [dough],
        variants: [
          variant({
            id: 49,
            productId: 18,
            sku: "MANAKISH-ZAATAR-REGULAR",
            unit: null,
            options: [doughOption(dough.values[0])],
            labelEn: "Regular",
            labelAr: "عادية",
            price: "1.000",
            sortOrder: 1,
          }),
          variant({
            id: 50,
            productId: 18,
            sku: "MANAKISH-ZAATAR-WHOLE-WHEAT",
            unit: null,
            options: [doughOption(dough.values[1])],
            labelEn: "Whole Wheat",
            labelAr: "قمح كامل",
            price: "1.000",
            sortOrder: 2,
          }),
        ],
        ingredients: [],
        addOns: [],
      },
    ],
  },
  {
    id: 3,
    nameEn: "Folded Sandwiches",
    nameAr: "سندويشات مطوية",
    imageUrl: null,
    sortOrder: 3,
    products: [
      {
        id: 23,
        slug: "folded-sandwiches-roast-beef-engineers",
        nameEn: "Roast Beef Folded Sandwich with Engineers Sauce",
        nameAr: "سندويش روست بيف مطوي مع صلصة انجنيرز",
        descriptionEn: null,
        descriptionAr: null,
        imageUrl: null,
        usesUnits: false,
        optionGroups: [],
        variants: [
          variant({
            id: 62,
            productId: 23,
            sku: "FOLDED-SANDWICHES-ROAST-BEEF-ENGINEERS",
            unit: null,
            options: [],
            labelEn: null,
            labelAr: null,
            price: "3.000",
            sortOrder: 1,
          }),
        ],
        ingredients: [],
        addOns: [],
      },
    ],
  },
  {
    id: 5,
    nameEn: "Pasta",
    nameAr: "باستا",
    imageUrl: null,
    sortOrder: 5,
    products: [
      {
        id: 31,
        slug: "pasta-penne-pesto",
        nameEn: "Penne Pesto",
        nameAr: "بيني بيستو",
        descriptionEn: null,
        descriptionAr: null,
        imageUrl: null,
        usesUnits: false,
        optionGroups: [pastaType],
        variants: [
          variant({
            id: 236,
            productId: 31,
            sku: "PASTA-PENNE-PESTO-REGULAR",
            unit: null,
            options: [pastaOption(pastaType.values[0])],
            labelEn: "Regular Penne",
            labelAr: "بيني عادي",
            price: "4.500",
            sortOrder: 1,
          }),
          variant({
            id: 237,
            productId: 31,
            sku: "PASTA-PENNE-PESTO-WHOLE-WHEAT",
            unit: null,
            options: [pastaOption(pastaType.values[1])],
            labelEn: "Whole Wheat Penne",
            labelAr: "بيني قمح كامل",
            price: "5.500",
            sortOrder: 2,
          }),
        ],
        ingredients: [
          { id: 20, nameEn: "Pesto Sauce", nameAr: "صلصة بيستو" },
          { id: 21, nameEn: "Parmesan", nameAr: "جبنة بارميزان" },
        ],
        addOns: [
          {
            addOnId: 4,
            nameEn: "Extra Chicken",
            nameAr: "إضافة دجاج",
            price: "1.000",
          },
        ],
      },
    ],
  },
  {
    id: 7,
    nameEn: "Drinks",
    nameAr: "مشروبات",
    imageUrl: null,
    sortOrder: 7,
    products: [
      {
        id: 56,
        slug: "drinks-soft-drink",
        nameEn: "Soft Drink",
        nameAr: "مشروب غازي",
        descriptionEn: null,
        descriptionAr: null,
        imageUrl: null,
        usesUnits: false,
        optionGroups: [],
        variants: [
          variant({
            id: 99,
            productId: 56,
            sku: "DRINKS-SOFT-DRINK",
            unit: null,
            options: [],
            labelEn: null,
            labelAr: null,
            price: "0.500",
            sortOrder: 1,
          }),
        ],
        ingredients: [],
        addOns: [],
      },
      {
        id: 57,
        slug: "drinks-water",
        nameEn: "Water",
        nameAr: "مياه",
        descriptionEn: null,
        descriptionAr: null,
        imageUrl: null,
        usesUnits: false,
        optionGroups: [],
        variants: [
          variant({
            id: 100,
            productId: 57,
            sku: "DRINKS-WATER",
            unit: null,
            options: [],
            labelEn: null,
            labelAr: null,
            price: "0.500",
            sortOrder: 1,
          }),
        ],
        ingredients: [],
        addOns: [],
      },
    ],
  },
  {
    id: 8,
    nameEn: "Staff Meal",
    nameAr: "وجبات الموظفين",
    imageUrl: null,
    sortOrder: 8,
    products: [],
  },
];
