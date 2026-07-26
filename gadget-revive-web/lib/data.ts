import { Product, Service, ProductCategory, ServiceCategory } from "./types";

// Mock categories
const pcComponentsCategory: ProductCategory = {
  id: 1,
  name: "PC Components",
  slug: "pc-components",
  description: "Computer parts and components",
  is_active: true,
};

const laptopPartsCategory: ProductCategory = {
  id: 2,
  name: "Laptop Parts",
  slug: "laptop-parts",
  description: "Replacement parts for laptops",
  is_active: true,
};

const desktopPartsCategory: ProductCategory = {
  id: 3,
  name: "Desktop Parts",
  slug: "desktop-parts",
  description: "Desktop computer parts",
  is_active: true,
};

const accessoriesCategory: ProductCategory = {
  id: 4,
  name: "Accessories",
  slug: "accessories",
  description: "Computer accessories",
  is_active: true,
};

const mobileRepairCategory: ServiceCategory = {
  id: 1,
  name: "Mobile Repair",
  slug: "mobile-repair",
  description: "Mobile device repair services",
  is_active: true,
};

const dataRecoveryCategory: ServiceCategory = {
  id: 2,
  name: "Data Recovery",
  slug: "data-recovery",
  description: "Data recovery services",
  is_active: true,
};

// Mock vendor
const mockVendor = {
  id: 1,
  business_name: "RecuvaPro",
  slug: "recuvapro",
  rating_average: 4.9,
};

export const sampleProducts: Product[] = [
  
];
