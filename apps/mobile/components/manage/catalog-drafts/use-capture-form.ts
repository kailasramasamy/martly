import { useState } from "react";
import { useLocalSearchParams } from "expo-router";

const toNumber = (text: string): number => Number(text.replace(/,/g, ""));

/** Name, MRP, selling price and stock for one product; `reset` clears it for the next shot */
export function useCaptureForm() {
  const { name: nameParam } = useLocalSearchParams<{ name?: string }>();
  const [name, setName] = useState(nameParam ?? "");
  const [mrp, setMrp] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");

  const mrpValue = toNumber(mrp);
  const priceValue = toNumber(price);
  const stockValue = stock.trim() === "" ? 0 : toNumber(stock);

  let priceError: string | null = null;
  if (price && !(priceValue > 0)) priceError = "Enter a valid price";
  else if (priceValue > mrpValue && mrpValue > 0) priceError = "Can't be above MRP";
  const mrpError = mrp && !(mrpValue > 0) ? "Enter a valid MRP" : null;
  const stockError = stock && !(Number.isInteger(stockValue) && stockValue >= 0) ? "Whole number" : null;
  const valid = mrpValue > 0 && priceValue > 0 && !priceError && !stockError;

  const reset = () => {
    setName("");
    setMrp("");
    setPrice("");
    setStock("");
  };

  return {
    name, setName, mrp, setMrp, price, setPrice, stock, setStock,
    mrpValue, priceValue, stockValue, mrpError, priceError, stockError, valid, reset,
  };
}
