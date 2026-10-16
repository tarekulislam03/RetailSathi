import React, { useEffect, useState, useRef } from "react";
import { Product, ProductInput } from "../../inventory/types";
import { fetchProducts, createProduct } from "../../inventory/services/inventoryService";
import { Customer } from "../../customers/types";
import { fetchCustomers } from "../../customers/services/customerService";
import { MarketingPerson } from "../../marketing/types";
import { fetchMarketingPersons } from "../../marketing/services/marketingService";
import { createSale, fetchTodayBillsCount } from "../services/billingService";
import { CartItem, Sale, HeldBill } from "../types";
import { BarcodeSearch, focusProductSearch } from "../components/BarcodeSearch";
import { CartTable } from "../components/CartTable";
import { CheckoutPanel } from "../components/CheckoutPanel";
import { ReceiptModal } from "../components/ReceiptModal";
import { ProductModal } from "../../inventory/components/ProductModal";
import { ReturnModal } from "../components/ReturnModal";
import { HeldBillsModal } from "../components/HeldBillsModal";
import {
  getHeldBills,
  saveHeldBill,
  removeHeldBill,
  clearAllHeldBills,
} from "../services/heldBillsService";

import { pullDataFromCloud } from "../../../services/syncProcessor";
import { useDbRefresh } from "../../../hooks/useDbRefresh";

export const BillingPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [marketingPersons, setMarketingPersons] = useState<MarketingPerson[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [todayBillsCount, setTodayBillsCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const isCheckingOutRef = useRef(false);

  // Customer & Bill Form
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [marketingPersonId, setMarketingPersonId] = useState<number | null>(null);
  const [paymentMode, setPaymentMode] = useState("Cash");

  // Completed Receipt Modal
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Quick Add Product Modal (for accidental billing of items not yet in inventory)
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  // Sales Return & Exchange Modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  // Held Bills (Park & Resume Orders)
  const [heldBills, setHeldBills] = useState<HeldBill[]>(() => getHeldBills());
  const [isHeldBillsOpen, setIsHeldBillsOpen] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

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

      // Keep cart product details synchronized if stock/name/category changed in DB while preserving cart-edited price & mrp
      setCart((prevCart) => {
        if (prevCart.length === 0) return prevCart;
        return prevCart.map((item) => {
          const fresh = prods.find((p) => p.id === item.product.id);
          if (fresh) {
            return {
              ...item,
              product: {
                ...fresh,
                price: item.product.price !== undefined ? item.product.price : fresh.price,
                mrp: item.product.mrp !== undefined ? item.product.mrp : fresh.mrp,
              },
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

  const handleHoldBillRef = useRef<() => void>(() => {});

  useEffect(() => {
    loadBillingData();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F4") {
        e.preventDefault();
        setIsReturnModalOpen((prev) => !prev);
      } else if (e.key === "F6") {
        e.preventDefault();
        handleHoldBillRef.current?.();
      } else if (e.key === "F7") {
        e.preventDefault();
        setIsHeldBillsOpen(true);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const lastAddRef = useRef<{ id: number; time: number }>({ id: 0, time: 0 });

  function handleAddToCart(product: Product) {
    const now = Date.now();
    if (lastAddRef.current.id === product.id && now - lastAddRef.current.time < 200) {
      return;
    }
    lastAddRef.current = { id: product.id, time: now };

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

  function handleUpdateCartPrice(productId: number, newPrice: number) {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, product: { ...item.product, price: newPrice } }
          : item
      )
    );
  }

  function handleUpdateCartMrp(productId: number, newMrp: number) {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, product: { ...item.product, mrp: newMrp } }
          : item
      )
    );
  }

  function handleRemoveItem(productId: number) {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    focusProductSearch();
  }

  async function handleSaveNewProduct(payload: ProductInput) {
    try {
      const createdProd = await createProduct(payload);
      setIsAddProductOpen(false);

      // Automatically add the new product to the cart
      handleAddToCart(createdProd);
      focusProductSearch();

      // Refresh product list in background
      await loadBillingData();
    } catch (err: any) {
      console.error("Failed to add product to inventory from billing:", err);
      setError(err?.message || "Failed to create product in inventory.");
    }
  }

  async function handleCheckout(paymentDetails?: {
    paymentMode: string;
    paidAmount: number;
    dueAmount: number;
    cashPaid: number;
    upiPaid: number;
  }) {
    if (isCheckingOutRef.current || isCheckingOut) {
      return;
    }
    if (cart.length === 0) {
      setError("Cannot checkout: Cart is empty.");
      return;
    }

    isCheckingOutRef.current = true;
    setIsCheckingOut(true);

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
      focusProductSearch();
    } catch (err: any) {
      console.error("Checkout error:", err);
      setError(err?.message || "Failed to complete transaction.");
    } finally {
      isCheckingOutRef.current = false;
      setIsCheckingOut(false);
    }
  }

  function handleHoldBill() {
    if (cart.length === 0) {
      setError("Cannot hold bill: Cart is empty.");
      return;
    }

    const totalMRP = cart.reduce(
      (acc, item) =>
        acc + (item.product.mrp || item.product.price) * item.quantity,
      0
    );
    const totalDiscount = cart.reduce((acc, item) => {
      const mrp = item.product.mrp || item.product.price;
      return acc + Math.max(0, mrp - item.product.price) * item.quantity;
    }, 0);
    const grandTotal = totalMRP - totalDiscount;
    const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);

    const saved = saveHeldBill({
      customer_name: customerName.trim() || undefined,
      customer_phone: customerPhone.trim() || undefined,
      marketing_person_id: marketingPersonId,
      payment_mode: paymentMode,
      cart: [...cart],
      total_mrp: totalMRP,
      grand_total: grandTotal,
      total_items: cart.length,
      total_qty: totalQty,
    });

    setHeldBills(getHeldBills());

    // Clear active cart & customer form so cashier can bill next customer immediately
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setMarketingPersonId(null);
    setPaymentMode("Cash");
    setError(null);
    setInfoMsg(`✓ Order for "${saved.customer_name || 'Walk-in Customer'}" (₹${grandTotal.toFixed(2)}) is on hold.`);
    setTimeout(() => setInfoMsg(null), 4000);
    focusProductSearch();
  }

  handleHoldBillRef.current = handleHoldBill;

  function handleResumeBill(bill: HeldBill) {
    // If current cart already has items, hold current cart first so nothing is lost!
    if (cart.length > 0) {
      const totalMRP = cart.reduce(
        (acc, item) =>
          acc + (item.product.mrp || item.product.price) * item.quantity,
        0
      );
      const totalDiscount = cart.reduce((acc, item) => {
        const mrp = item.product.mrp || item.product.price;
        return acc + Math.max(0, mrp - item.product.price) * item.quantity;
      }, 0);
      const grandTotal = totalMRP - totalDiscount;
      const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);

      saveHeldBill({
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        marketing_person_id: marketingPersonId,
        payment_mode: paymentMode,
        cart: [...cart],
        total_mrp: totalMRP,
        grand_total: grandTotal,
        total_items: cart.length,
        total_qty: totalQty,
      });
    }

    // Load held bill into active cart & form
    setCart(bill.cart);
    setCustomerName(bill.customer_name || "");
    setCustomerPhone(bill.customer_phone || "");
    setMarketingPersonId(bill.marketing_person_id || null);
    setPaymentMode(bill.payment_mode || "Cash");

    // Remove resumed bill from held list
    const updated = removeHeldBill(bill.id);
    setHeldBills(updated);
    setIsHeldBillsOpen(false);
    setError(null);
    setInfoMsg(`✓ Resumed order for "${bill.customer_name || 'Walk-in Customer'}".`);
    setTimeout(() => setInfoMsg(null), 3000);
    focusProductSearch();
  }

  function handleDiscardHeldBill(id: string) {
    const updated = removeHeldBill(id);
    setHeldBills(updated);
  }

  function handleClearAllHeldBills() {
    clearAllHeldBills();
    setHeldBills([]);
  }

  return (
    <>
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>X</button>
        </div>
      )}

      {infoMsg && (
        <div
          style={{
            background: "linear-gradient(to bottom, #ecfdf5 0%, #d1fae5 100%)",
            border: "1px solid #6ee7b7",
            color: "#065f46",
            padding: "8px 14px",
            borderRadius: "4px",
            margin: "0 0 10px 0",
            fontSize: "0.85rem",
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <span>{infoMsg}</span>
          <button
            type="button"
            onClick={() => setInfoMsg(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#065f46",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
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
            onUpdatePrice={handleUpdateCartPrice}
            onUpdateMrp={handleUpdateCartMrp}
            onRemoveItem={handleRemoveItem}
            onClearCart={() => {
              setCart([]);
              focusProductSearch();
            }}
            onOpenAddProduct={() => setIsAddProductOpen(true)}
            onOpenReturnModal={() => setIsReturnModalOpen(true)}
            onHoldBill={handleHoldBill}
            onOpenHeldBills={() => setIsHeldBillsOpen(true)}
            heldBillsCount={heldBills.length}
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
            isProcessing={isCheckingOut}
          />
        </div>
      </div>

      {isAddProductOpen && (
        <ProductModal
          editingProduct={null}
          title="Add Product to Inventory & Cart"
          submitButtonText="Save to Inventory & Add to Cart"
          onSave={handleSaveNewProduct}
          onClose={() => {
            setIsAddProductOpen(false);
            focusProductSearch();
          }}
        />
      )}

      {isReturnModalOpen && (
        <ReturnModal
          isOpen={isReturnModalOpen}
          onClose={() => {
            setIsReturnModalOpen(false);
            focusProductSearch();
          }}
          products={products}
          onReturnComplete={(updatedSale) => {
            setIsReturnModalOpen(false);
            setCompletedSale(updatedSale);
            loadBillingData();
            focusProductSearch();
          }}
        />
      )}

      {isHeldBillsOpen && (
        <HeldBillsModal
          isOpen={isHeldBillsOpen}
          onClose={() => {
            setIsHeldBillsOpen(false);
            focusProductSearch();
          }}
          heldBills={heldBills}
          onResume={handleResumeBill}
          onDiscard={handleDiscardHeldBill}
          onClearAll={handleClearAllHeldBills}
        />
      )}

      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          onClose={() => {
            setCompletedSale(null);
            focusProductSearch();
          }}
          autoPrint={false}
        />
      )}
    </>
  );
};
