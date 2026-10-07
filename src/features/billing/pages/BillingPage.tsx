import React, { useEffect, useState } from "react";
import { Product } from "../../inventory/types";
import { fetchProducts } from "../../inventory/services/inventoryService";
import { Customer } from "../../customers/types";
import { fetchCustomers } from "../../customers/services/customerService";
import { MarketingPerson } from "../../marketing/types";
import { fetchMarketingPersons } from "../../marketing/services/marketingService";
import { createSale, fetchTodayBillsCount } from "../services/billingService";
import { CartItem, Sale } from "../types";
import { BarcodeSearch } from "../components/BarcodeSearch";
import { CartTable } from "../components/CartTable";
import { CheckoutPanel } from "../components/CheckoutPanel";
import { ReceiptModal } from "../components/ReceiptModal";

import { pullDataFromCloud } from "../../../services/syncProcessor";
import { useDbRefresh } from "../../../hooks/useDbRefresh";

export const BillingPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [marketingPersons, setMarketingPersons] = useState<MarketingPerson[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [todayBillsCount, setTodayBillsCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Customer & Bill Form
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [marketingPersonId, setMarketingPersonId] = useState<number | null>(null);
  const [paymentMode, setPaymentMode] = useState("Cash");

  // Completed Receipt Modal
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  async function loadBillingData() {
    try {
      let prods = await fetchProducts();
      if (prods.length === 0 && typeof navigator !== "undefined" && navigator.onLine) {
        await pullDataFromCloud();
        prods = await fetchProducts();
      }
      const [custs, mkts, billCount] = await Promise.all([
        fetchCustomers(),
        fetchMarketingPersons(),
        fetchTodayBillsCount(),
      ]);
      setProducts(prods);
      setCustomers(custs);
      setMarketingPersons(mkts);
      setTodayBillsCount(billCount);

      // Keep cart product details synchronized if a product name/price/stock changed in DB
      setCart((prevCart) => {
        if (prevCart.length === 0) return prevCart;
        return prevCart.map((item) => {
          const fresh = prods.find((p) => p.id === item.product.id);
          if (fresh) {
            return {
              ...item,
              product: fresh,
              total: fresh.price * item.quantity,
            };
          }
          return item;
        });
      });
    } catch (err: any) {
      // Ignore background refresh errors
    }
  }

  // Constant live refresh: syncs every 2.5 seconds, on window focus, and on database sync events
  useDbRefresh(loadBillingData, 2500);

  useEffect(() => {
    loadBillingData();
  }, []);

  function handleAddToCart(product: Product) {
    if (product.stock <= 0) {
      setError(`"${product.name}" is out of stock!`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          setError(
            `Cannot add more "${product.name}". Available stock is ${product.stock}.`
          );
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prev, { product, quantity: 1 }];
      }
    });
  }

  function handleUpdateCartQty(productId: number, newQty: number) {
    if (newQty <= 0) {
      handleRemoveItem(productId);
      return;
    }

    const item = cart.find((i) => i.product.id === productId);
    if (item && newQty > item.product.stock) {
      setError(`Only ${item.product.stock} units available for "${item.product.name}".`);
      return;
    }

    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity: newQty } : item
      )
    );
  }

  function handleRemoveItem(productId: number) {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }

  async function handleCheckout(paymentDetails?: {
    paymentMode: string;
    paidAmount: number;
    dueAmount: number;
    cashPaid: number;
    upiPaid: number;
  }) {
    if (cart.length === 0) {
      setError("Cannot checkout: Cart is empty.");
      return;
    }

    try {
      setError(null);

      // Compute Total MRP, Discount, and Inclusive GST
      const totalMRP = cart.reduce(
        (acc, item) =>
          acc + (item.product.mrp || item.product.price) * item.quantity,
        0
      );
      const totalDiscount = cart.reduce((acc, item) => {
        const mrp = item.product.mrp || item.product.price;
        return acc + Math.max(0, mrp - item.product.price) * item.quantity;
      }, 0);

      let totalGstAmount = 0;
      for (const item of cart) {
        const itemSellingTotal = item.product.price * item.quantity;
        const gstRate = item.product.gst_rate || 0;
        if (gstRate > 0) {
          const itemTaxable = itemSellingTotal / (1 + gstRate / 100);
          totalGstAmount += itemSellingTotal - itemTaxable;
        }
      }

      const saleResult = await createSale({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        total_mrp: totalMRP,
        discount: totalDiscount,
        tax_amount: totalGstAmount,
        payment_mode: paymentDetails?.paymentMode || paymentMode,
        paid_amount: paymentDetails?.paidAmount,
        due_amount: paymentDetails?.dueAmount,
        cash_paid: paymentDetails?.cashPaid,
        upi_paid: paymentDetails?.upiPaid,
        marketing_person_id: marketingPersonId,
        items: cart.map((c) => ({
          product_id: c.product.id,
          product_name: c.product.name,
          barcode: c.product.barcode,
          price: c.product.price,
          quantity: c.quantity,
          mrp: c.product.mrp || c.product.price,
          gst_rate: c.product.gst_rate || 0,
        })),
      });

      // Clear Form & Cart
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setMarketingPersonId(null);
      setPaymentMode("Cash");

      setCompletedSale(saleResult);
      await loadBillingData();
    } catch (err: any) {
      console.error("Checkout error:", err);
      setError(err?.message || "Failed to complete transaction.");
    }
  }

  return (
    <>
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>X</button>
        </div>
      )}

      <div className="pos-layout">
        <div className="pos-left">
          <BarcodeSearch
            products={products}
            onAddToCart={handleAddToCart}
            onError={(msg) => setError(msg)}
            todayBillsCount={todayBillsCount}
          />

          <CartTable
            cart={cart}
            onUpdateQty={handleUpdateCartQty}
            onRemoveItem={handleRemoveItem}
            onClearCart={() => setCart([])}
          />
        </div>

        <div className="pos-right">
          <CheckoutPanel
            cart={cart}
            customers={customers}
            marketingPersons={marketingPersons}
            customerName={customerName}
            setCustomerName={setCustomerName}
            customerPhone={customerPhone}
            setCustomerPhone={setCustomerPhone}
            marketingPersonId={marketingPersonId}
            setMarketingPersonId={setMarketingPersonId}
            paymentMode={paymentMode}
            setPaymentMode={setPaymentMode}
            onCheckout={handleCheckout}
          />
        </div>
      </div>

      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          onClose={() => setCompletedSale(null)}
          autoPrint={false}
        />
      )}
    </>
  );
};
