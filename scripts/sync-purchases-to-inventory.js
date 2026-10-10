import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://sfbzeehmjrarhprpagxy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmYnplZWhtanJhcmhwcnBhZ3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzODk0NjMsImV4cCI6MjEwNDk2NTQ2M30.lENrO2VCCGEAEuiuOEB1JCzKiFDcV8fY6Nn49Pw-Cto";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function syncPurchaseItemsToProducts() {
  console.log("Fetching purchase items from Supabase...");
  const { data: purchaseItems, error: piErr } = await supabase
    .from("purchase_items")
    .select("*")
    .order("id", { ascending: true });

  if (piErr || !purchaseItems) {
    console.error("Failed to fetch purchase items:", piErr);
    process.exit(1);
  }

  console.log(`Found ${purchaseItems.length} purchase items.`);

  console.log("Fetching existing products from Supabase...");
  const { data: existingProducts, error: prodErr } = await supabase
    .from("products")
    .select("*");

  if (prodErr) {
    console.error("Failed to fetch products:", prodErr);
    process.exit(1);
  }

  const productMapByName = new Map();
  (existingProducts || []).forEach((p) => {
    productMapByName.set(p.name.trim().toLowerCase(), p);
  });

  let insertedCount = 0;
  let updatedCount = 0;

  for (const item of purchaseItems) {
    const normName = (item.product_name || "").trim().toLowerCase();
    const existing = productMapByName.get(normName);

    // Extract suggested MRP if present in product name e.g. "10/-" or "20/-"
    let mrpVal = Number(item.mrp) || 0;
    if (mrpVal === 0) {
      const match = (item.product_name || "").match(/(\d+)\s*\/\-/);
      if (match) {
        mrpVal = Number(match[1]);
      }
    }
    if (mrpVal === 0 && Number(item.purchase_price) > 0) {
      mrpVal = Number(item.purchase_price);
    }

    const costPriceVal = Number(item.purchase_price) || 0;
    const sellingPriceVal =
      Number(item.selling_price) > 0
        ? Number(item.selling_price)
        : mrpVal > 0
        ? mrpVal
        : costPriceVal;

    // Do NOT generate unique barcode - barcode is left null so user can scan and add manually
    const barcodeVal = item.barcode && item.barcode.trim() ? item.barcode.trim() : null;

    if (existing) {
      console.log(`Updating existing product for "${item.product_name}" (ID: ${existing.id})...`);
      const updatedStock = Number(existing.stock || 0) + Number(item.quantity || 0);
      const { data: updatedProd, error: updateErr } = await supabase
        .from("products")
        .update({
          stock: updatedStock,
          cost_price: costPriceVal,
          price: sellingPriceVal,
          mrp: mrpVal,
          barcode: existing.barcode || barcodeVal,
          hsn_code: item.hsn_code || existing.hsn_code || null,
          gst_rate: Number(item.gst_rate) || existing.gst_rate || 0,
          category: item.category || existing.category || "General",
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateErr) {
        console.error(`Failed to update product ${existing.id}:`, updateErr);
      } else {
        updatedCount++;
        await supabase
          .from("purchase_items")
          .update({ product_id: existing.id })
          .eq("id", item.id);
      }
    } else {
      console.log(`Inserting new product for "${item.product_name}"...`);
      const newProduct = {
        name: item.product_name.trim(),
        barcode: barcodeVal,
        batch_no: item.batch_no || null,
        stock: Number(item.quantity) || 0,
        cost_price: costPriceVal,
        price: sellingPriceVal,
        mrp: mrpVal,
        hsn_code: item.hsn_code || null,
        gst_rate: Number(item.gst_rate) || 0,
        category: item.category || "General",
        reorder_threshold: 5,
        created_at: new Date().toISOString(),
      };

      const { data: insertedProd, error: insertErr } = await supabase
        .from("products")
        .insert([newProduct])
        .select()
        .single();

      if (insertErr) {
        console.error(`Failed to insert product "${item.product_name}":`, insertErr);
      } else if (insertedProd) {
        insertedCount++;
        productMapByName.set(normName, insertedProd);

        await supabase
          .from("purchase_items")
          .update({ product_id: insertedProd.id })
          .eq("id", item.id);
      }
    }
  }

  console.log(`\nSync finished! Inserted: ${insertedCount}, Updated: ${updatedCount}`);

  // Verify total products now in Supabase
  const { data: finalProducts, count } = await supabase
    .from("products")
    .select("id, name, barcode, stock, cost_price, price, mrp, gst_rate, category", { count: "exact" });

  console.log(`\nTotal products in Supabase products table: ${count}`);
  console.log("Sample 5 products:", (finalProducts || []).slice(0, 5));
}

syncPurchaseItemsToProducts().catch(console.error);
