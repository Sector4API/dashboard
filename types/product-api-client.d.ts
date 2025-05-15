declare module "product-api-client" {
  export interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
  }

  export function getAllProducts(): Promise<Product[]>;
}
