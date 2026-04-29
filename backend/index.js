const express = require("express");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ROUTE 1
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// ROUTE 2
app.post("/webhooks/jotform", (req, res) => {
  console.log("Jotform webhook received:");
  console.log(req.body);

  res.json({ ok: true });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
