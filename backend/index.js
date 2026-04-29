const express = require("express");
const { Pool } = require("pg");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway")
    ? { rejectUnauthorized: false }
    : false
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/webhooks/jotform", async (req, res) => {
  try {
    const payload = req.body;

    console.log("Jotform webhook received:");
    console.log(payload);

    const result = await db.query(
      `
      INSERT INTO contacts (
        name,
        surname,
        company,
        email,
        phone,
        request_detail,
        submit_page,
        status,
        service_category,
        source,
        location,
        create_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
      RETURNING contact_id
      `,
      [
        payload.name || payload.contact_name || null,
        payload.surname || payload.last_name || null,
        payload.company || payload.company_name || null,
        payload.email || null,
        payload.phone || null,
        payload.request_detail || payload.message || payload.notes || null,
        payload.submit_page || "jotform",
        "new",
        payload.service_category || payload.service_required || null,
        "jotform",
        payload.location || payload.country || null
      ]
    );

    const contactId = result.rows[0].contact_id;

    res.json({
      ok: true,
      contactId
    });
  } catch (err) {
    console.error("Failed to insert contact:", err.message);

    res.status(500).json({
      ok: false,
      error: "Failed to insert contact"
    });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
