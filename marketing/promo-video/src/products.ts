export type Product = { name: string; size: string; price: number; image: string; stock: number };

export const products: Product[] = [
  { name: "Amul Taaza Milk", size: "500 ml", price: 24, image: "products/milk.webp", stock: 64 },
  { name: "Aashirvaad Atta", size: "1 kg", price: 79, image: "products/atta.webp", stock: 38 },
  { name: "Fortune Sunflower Oil", size: "500 ml", price: 68, image: "products/oil.webp", stock: 22 },
  { name: "Parle-G Gold", size: "500 g", price: 50, image: "products/parleg.png", stock: 51 },
  { name: "Maggi Masala", size: "32 g", price: 5, image: "products/maggi.webp", stock: 4 },
  { name: "Tata Tea Premium", size: "1.5 kg", price: 722, image: "products/tea.webp", stock: 17 },
  { name: "Lay's Cream & Onion", size: "143 g", price: 74, image: "products/lays.webp", stock: 29 },
  { name: "India Gate Basmati", size: "2 kg", price: 518, image: "products/rice.webp", stock: 12 },
];

export const rupee = (n: number) => `₹${n.toLocaleString("en-IN")}`;
