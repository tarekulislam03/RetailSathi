import { getDb } from "../../../services/database";
import { Supplier, SupplierInput } from "../types/supplier";

export async function fetchSuppliers(): Promise<Supplier[]> {
  const db = await getDb();
  return await db.select<Supplier[]>("SELECT * FROM suppliers ORDER BY name ASC");
}

export async function createSupplier(input: SupplierInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO suppliers (name, company_name, gst_no, contact_no, email, address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.name.trim(),
      input.company_name?.trim() || "",
      input.gst_no?.trim() || "",
      input.contact_no?.trim() || "",
      input.email?.trim() || "",
      input.address?.trim() || "",
    ]
  );
}

export async function updateSupplier(
  id: number,
  input: SupplierInput
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE suppliers 
     SET name = $1, company_name = $2, gst_no = $3, contact_no = $4, email = $5, address = $6
     WHERE id = $7`,
    [
      input.name.trim(),
      input.company_name?.trim() || "",
      input.gst_no?.trim() || "",
      input.contact_no?.trim() || "",
      input.email?.trim() || "",
      input.address?.trim() || "",
      id,
    ]
  );
}

export async function deleteSupplier(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM suppliers WHERE id = $1", [id]);
}
