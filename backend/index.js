const express = require("express");
const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");

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

function normalizeLeadPayload(payload) {
  return {
    name: payload.name || payload.contact_name || null,
    surname: payload.surname || payload.last_name || null,
    company: payload.company || payload.company_name || null,
    email: payload.email || null,
    phone: payload.phone || null,
    request_detail: payload.request_detail || payload.message || payload.notes || null,
    submit_page: payload.submit_page || "jotform",
    service_category: payload.service_category || payload.service_required || null,
    source: payload.source || "jotform",
    location: payload.location || payload.country || null
  };
}

function validateLead(payload) {
  const missing = [];

  if (!payload.name) missing.push("name");
  if (!payload.email) missing.push("email");

  return missing;
}

app.post("/workflow/start", async (req, res) => {
  const client = await db.connect();

  try {
    const originalPayload = req.body;
    const lead = normalizeLeadPayload(originalPayload);
    const missing = validateLead(lead);

    if (missing.length > 0) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields",
        missing
      });
    }

    await client.query("BEGIN");

    const workflowInstanceId = uuidv4();

    const workflowResult = await client.query(
      `
      INSERT INTO workflow_instances (
        id,
        workflow_type,
        current_stage,
        current_step,
        status,
        original_payload,
        state,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
      RETURNING id
      `,
      [
        workflowInstanceId,
        "lead_to_order",
        "inbound_leads",
        "engagement",
        "active",
        originalPayload,
        {
          allowed_actions: ["mark_qualified", "mark_ghosted"],
          lead
        }
      ]
    );

    const contactResult = await client.query(
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
        workflow_instance_id,
        create_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
      RETURNING contact_id
      `,
      [
        lead.name,
        lead.surname,
        lead.company,
        lead.email,
        lead.phone,
        lead.request_detail,
        lead.submit_page,
        "engagement",
        lead.service_category,
        lead.source,
        lead.location,
        workflowInstanceId
      ]
    );

    const contactId = contactResult.rows[0].contact_id;

    await client.query(
      `
      UPDATE workflow_instances
      SET related_contact_id = $1, updated_at = now()
      WHERE id = $2
      `,
      [contactId, workflowInstanceId]
    );

    await client.query(
      `
      INSERT INTO workflow_events (
        id,
        workflow_instance_id,
        action,
        from_step,
        to_step,
        payload,
        actor_id,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      `,
      [
        uuidv4(),
        workflowInstanceId,
        "workflow_started",
        null,
        "engagement",
        originalPayload,
        "system"
      ]
    );

    await client.query("COMMIT");

    res.json({
      ok: true,
      workflowInstanceId: workflowResult.rows[0].id,
      contactId,
      currentStage: "inbound_leads",
      currentStep: "engagement",
      allowedActions: ["mark_qualified", "mark_ghosted"]
    });
  } catch (err) {
    await client.query("ROLLBACK");

    console.error("Failed to start workflow:", err.message);

    res.status(500).json({
      ok: false,
      error: "Failed to start workflow"
    });
  } finally {
    client.release();
  }
});

app.post("/webhooks/jotform", async (req, res) => {
  req.url = "/workflow/start";
  app._router.handle(req, res);
});

app.get("/workflow/:id", async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT *
      FROM workflow_instances
      WHERE id = $1
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "Workflow instance not found"
      });
    }

    res.json({
      ok: true,
      workflow: result.rows[0]
    });
  } catch (err) {
    console.error("Failed to read workflow:", err.message);

    res.status(500).json({
      ok: false,
      error: "Failed to read workflow"
    });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
