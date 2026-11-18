const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { dbPath } = require('./db');

const bananaTypesRouter = require('./routes/bananaTypes');
const customersRouter = require('./routes/customers');
const billsRouter = require('./routes/bills');

const app = express();
const PORT = process.env.PORT || 4567;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/banana-types', bananaTypesRouter);
app.use('/api/customers', customersRouter);
app.use('/api/bills', billsRouter);

// Health & System Info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'KRS Banana Billing Backend',
    database: dbPath,
    timestamp: new Date().toISOString()
  });
});

// In production, serve Vite built static files if dist exists
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // Express 5 compatible SPA fallback
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

function startServer(port = PORT) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`[Express] Backend server running on http://127.0.0.1:${port}`);
      resolve({ server, port });
    });
    server.on('error', (err) => {
      console.error('[Express] Server failed to start:', err);
      reject(err);
    });
  });
}

// Auto-run if executed directly
if (require.main === module) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer
};
