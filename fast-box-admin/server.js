import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const ajv = new Ajv({ allErrors: true });

app.use(cors());
app.use(express.json());

const REGISTRY_DIR = path.resolve(__dirname, '../fast-box-registry/packages');
const SCHEMA_FILE = path.resolve(__dirname, '../fast-box-registry/schemas/package.schema.json');

// Ensure registry directory exists
if (!fs.existsSync(REGISTRY_DIR)) {
  fs.mkdirSync(REGISTRY_DIR, { recursive: true });
}

// GET /api/packages - List packages
app.get('/api/packages', (req, res) => {
  try {
    const files = fs.readdirSync(REGISTRY_DIR);
    const packages = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(REGISTRY_DIR, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content);
          packages.push({
            name: data.name || file.replace('.json', ''),
            displayName: data.displayName || data.name,
            description: data.description || '',
            defaultVersion: data.defaultVersion || '',
            homepage: data.homepage || '',
            license: data.license || '',
            versionsCount: Object.keys(data.versions || {}).length,
            platforms: Object.keys(data.versions?.[data.defaultVersion]?.platforms || {})
          });
        } catch (e) {
          console.error(`Error reading/parsing ${file}:`, e);
          packages.push({
            name: file.replace('.json', ''),
            displayName: file.replace('.json', ''),
            error: `Failed to load: ${e.message}`
          });
        }
      }
    }
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: `Failed to list packages: ${err.message}` });
  }
});

// GET /api/packages/:name - Get full details of a package
app.get('/api/packages/:name', (req, res) => {
  const { name } = req.params;
  const filePath = path.join(REGISTRY_DIR, `${name}.json`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `Package ${name} not found` });
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: `Failed to read package: ${err.message}` });
  }
});

// POST /api/packages - Create a new package
app.post('/api/packages', (req, res) => {
  const { name, displayName, description, homepage, license, defaultVersion } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Package name is required' });
  }

  const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
  if (!cleanName) {
    return res.status(400).json({ error: 'Invalid package name' });
  }

  const filePath = path.join(REGISTRY_DIR, `${cleanName}.json`);
  if (fs.existsSync(filePath)) {
    return res.status(400).json({ error: `Package ${cleanName} already exists` });
  }

  const initialRecipe = {
    $schema: "../schemas/package.schema.json",
    name: cleanName,
    displayName: displayName || name,
    description: description || "",
    homepage: homepage || "",
    license: license || "MIT",
    installMode: "archive",
    managedInstallPath: `{fastbox_home}/packages/${cleanName}/{version}`,
    defaultVersion: defaultVersion || "1.0.0",
    channels: {
      latest: defaultVersion || "1.0.0"
    },
    versions: {
      [defaultVersion || "1.0.0"]: {
        version: defaultVersion || "1.0.0",
        channel: "latest",
        platforms: {},
        verify: []
      }
    },
    bins: [
      {
        name: cleanName,
        relativePath: `bin/${cleanName}`,
        windowsRelativePath: `${cleanName}.exe`
      }
    ],
    activation: {
      strategy: "shimActiveVersion",
      statePath: "{fastbox_home}/state/active.json",
      desktopAction: "setActiveVersion",
      optionalCliCommand: `fastbox use ${cleanName}@{version}`
    },
    uninstall: {
      strategy: "removeManagedVersionDirectoryAndRefreshShims",
      removePaths: [
        `{fastbox_home}/packages/${cleanName}/{version}`
      ]
    }
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(initialRecipe, null, 2), 'utf-8');
    res.status(201).json(initialRecipe);
  } catch (err) {
    res.status(500).json({ error: `Failed to create package file: ${err.message}` });
  }
});

// PUT /api/packages/:name - Update package
app.put('/api/packages/:name', (req, res) => {
  const { name } = req.params;
  const filePath = path.join(REGISTRY_DIR, `${name}.json`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `Package ${name} not found` });
  }

  try {
    const updatedData = req.body;

    // Load schema
    if (!fs.existsSync(SCHEMA_FILE)) {
      return res.status(500).json({ error: 'Schema file package.schema.json not found' });
    }
    const schemaContent = fs.readFileSync(SCHEMA_FILE, 'utf-8');
    const schema = JSON.parse(schemaContent);

    // Validate using Ajv
    const validate = ajv.compile(schema);
    const valid = validate(updatedData);

    if (!valid) {
      const errorMsg = validate.errors.map(err => {
        const pathPart = err.instancePath ? `Field "${err.instancePath}"` : 'JSON';
        return `${pathPart} ${err.message}`;
      }).join(', ');
      return res.status(400).json({ error: `Schema validation failed: ${errorMsg}` });
    }

    // Double check name consistency
    if (updatedData.name !== name) {
      return res.status(400).json({ error: 'Cannot change package name. Package name inside JSON must match filename.' });
    }

    fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2), 'utf-8');
    res.json({ success: true, data: updatedData });
  } catch (err) {
    res.status(500).json({ error: `Failed to update package: ${err.message}` });
  }
});

// DELETE /api/packages/:name - Delete a package
app.delete('/api/packages/:name', (req, res) => {
  const { name } = req.params;
  const filePath = path.join(REGISTRY_DIR, `${name}.json`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `Package ${name} not found` });
  }

  try {
    fs.unlinkSync(filePath);
    res.json({ success: true, message: `Package ${name} deleted successfully` });
  } catch (err) {
    res.status(500).json({ error: `Failed to delete package: ${err.message}` });
  }
});

// GET /api/schema - Read package schema
app.get('/api/schema', (req, res) => {
  if (!fs.existsSync(SCHEMA_FILE)) {
    return res.status(404).json({ error: 'Schema file not found' });
  }
  try {
    const content = fs.readFileSync(SCHEMA_FILE, 'utf-8');
    res.json(JSON.parse(content));
  } catch (err) {
    res.status(500).json({ error: `Failed to read schema: ${err.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`[API Server] Running at http://localhost:${PORT}`);
});
