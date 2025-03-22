/**
 * Utility to generate TypeScript server code from MCP schema
 */

interface MCPParameter {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  enum?: string[];
  properties?: Record<string, MCPParameter>;
  items?: {
    type: string;
    properties?: Record<string, MCPParameter>;
  };
}

interface MCPAction {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, MCPParameter>;
    required: string[];
  };
}

/**
 * Generates TypeScript interface from MCP parameter
 */
const generateTypeScriptInterface = (name: string, param: MCPParameter): string => {
  if (param.type === 'object' && param.properties) {
    const properties = Object.entries(param.properties).map(([propName, propSchema]) => {
      const isRequired = propSchema.required ? '' : '?';
      return `  ${propName}${isRequired}: ${getTypeScriptType(propSchema)};`;
    }).join('\n');
    
    return `interface ${name} {\n${properties}\n}`;
  }
  
  return '';
};

/**
 * Gets TypeScript type from MCP parameter
 */
const getTypeScriptType = (param: MCPParameter): string => {
  switch (param.type) {
    case 'string':
      return 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      if (param.items) {
        if (param.items.type === 'object' && param.items.properties) {
          return `Array<{${Object.entries(param.items.properties).map(([propName, propSchema]) => {
            const isRequired = propSchema.required ? '' : '?';
            return `${propName}${isRequired}: ${getTypeScriptType(propSchema)}`;
          }).join(', ')}}>`;
        }
        return `Array<${param.items.type === 'integer' ? 'number' : param.items.type}>`;
      }
      return 'any[]';
    case 'object':
      if (param.properties) {
        return `{${Object.entries(param.properties).map(([propName, propSchema]) => {
          const isRequired = propSchema.required ? '' : '?';
          return `${propName}${isRequired}: ${getTypeScriptType(propSchema)}`;
        }).join(', ')}}`;
      }
      return 'Record<string, any>';
    default:
      return 'any';
  }
};

/**
 * Generates TypeScript server code from MCP schema
 */
export const generateTypeScriptServer = (mcpSchema: string, contractAddress: string, contractName: string): string => {
  try {
    const actions: MCPAction[] = JSON.parse(mcpSchema);
    
    // Generate interfaces
    const interfaces: string[] = [];
    const functionParams: Record<string, string> = {};
    
    actions.forEach(action => {
      const interfaceName = `${action.name.charAt(0).toUpperCase() + action.name.slice(1)}Params`;
      functionParams[action.name] = interfaceName;
      
      const properties = Object.entries(action.parameters.properties).map(([propName, propSchema]) => {
        const isRequired = action.parameters.required.includes(propName) ? '' : '?';
        return `  ${propName}${isRequired}: ${getTypeScriptType(propSchema)};`;
      }).join('\n');
      
      interfaces.push(`interface ${interfaceName} {\n${properties}\n}`);
    });
    
    // Generate server code
    const serverCode = `import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import { WebSocketServer } from 'ws';
import http from 'http';

// Contract ABI interfaces
${interfaces.join('\n\n')}

// Initialize Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Contract configuration
const CONTRACT_ADDRESS = '${contractAddress}';
const CONTRACT_ABI = /* ABI JSON goes here */;
const CONTRACT_NAME = '${contractName || 'SmartContract'}';

// Provider setup - replace with your preferred provider
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY');

// Initialize contract instance
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

// Connect with a signer for state-changing operations
// const signer = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);
// const contractWithSigner = contract.connect(signer);

// MCP Schema endpoint
app.get('/mcp-schema', (req, res) => {
  res.json(${mcpSchema});
});

// GPT Actions Schema endpoint
app.get('/gpt-actions-schema', (req, res) => {
  // Convert MCP schema to GPT Actions format
  const mcpSchema = ${mcpSchema};
  const gptActions = mcpSchema.map(action => ({
    type: 'function',
    function: {
      name: action.name,
      description: action.description,
      parameters: action.parameters
    }
  }));
  
  res.json(gptActions);
});

${actions.map(action => {
  const interfaceName = functionParams[action.name];
  const isStateChanging = !action.description.includes('does not modify blockchain state');
  const functionBody = isStateChanging 
    ? `  try {
    // This function modifies state, so it requires a signer
    // Uncomment and configure the signer above to enable this functionality
    // const tx = await contractWithSigner.${action.name}(${action.parameters.required.map(param => `params.${param}`).join(', ')});
    // const receipt = await tx.wait();
    // return res.json({ success: true, txHash: receipt.transactionHash });
    
    // For now, return a message that state-changing operations are not enabled
    return res.status(501).json({ 
      error: 'State-changing operations are not enabled in this demo server',
      message: 'To enable this functionality, configure a signer with a private key'
    });
  } catch (error) {
    console.error(\`Error calling ${action.name}:\`, error);
    return res.status(500).json({ error: \`Failed to call ${action.name}\` });
  }`
    : `  try {
    const result = await contract.${action.name}(${action.parameters.required.map(param => `params.${param}`).join(', ')});
    return res.json({ success: true, result });
  } catch (error) {
    console.error(\`Error calling ${action.name}:\`, error);
    return res.status(500).json({ error: \`Failed to call ${action.name}\` });
  }`;
  
  return `// ${action.description}
app.post('/contract/${action.name}', async (req, res) => {
  const params = req.body as ${interfaceName};
  
  // Validate required parameters
  const requiredParams = ${JSON.stringify(action.parameters.required)};
  const missingParams = requiredParams.filter(param => params[param] === undefined);
  
  if (missingParams.length > 0) {
    return res.status(400).json({ 
      error: 'Missing required parameters', 
      missingParams 
    });
  }
  
${functionBody}
});`;
}).join('\n\n')}

// WebSocket handling for real-time updates
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Send welcome message
  ws.send(JSON.stringify({ 
    type: 'info', 
    message: \`Connected to ${CONTRACT_NAME} MCP server\` 
  }));
  
  // Handle incoming messages
  ws.on('message', async (message) => {
    try {
      const { action, params } = JSON.parse(message.toString());
      
      // Find the corresponding action
      const mcpAction = ${mcpSchema}.find(a => a.name === action);
      
      if (!mcpAction) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: \`Action \${action} not found\` 
        }));
        return;
      }
      
      // Validate required parameters
      const requiredParams = mcpAction.parameters.required;
      const missingParams = requiredParams.filter(param => params[param] === undefined);
      
      if (missingParams.length > 0) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Missing required parameters', 
          missingParams 
        }));
        return;
      }
      
      // Call the contract function
      try {
        const result = await contract[action](...requiredParams.map(param => params[param]));
        ws.send(JSON.stringify({ 
          type: 'result', 
          action, 
          result 
        }));
      } catch (error) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: \`Error calling \${action}\`, 
          error: error.message 
        }));
      }
    } catch (error) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid message format', 
        error: error.message 
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(\`MCP server for \${CONTRACT_NAME} running on port \${PORT}\`);
  console.log(\`REST API: http://localhost:\${PORT}/\`);
  console.log(\`WebSocket: ws://localhost:\${PORT}\`);
});
`;

    return serverCode;
  } catch (error) {
    console.error('Error generating TypeScript server:', error);
    throw new Error('Failed to generate TypeScript server');
  }
};

/**
 * Generates a Dockerfile for the TypeScript server
 */
export const generateDockerfile = (): string => {
  return `FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy server code
COPY . .

# Build TypeScript code
RUN npm run build

# Expose port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
`;
};

/**
 * Generates a package.json for the TypeScript server
 */
export const generatePackageJson = (contractName: string): string => {
  return `{
  "name": "${contractName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-mcp-server",
  "version": "1.0.0",
  "description": "MCP-compatible server for ${contractName} smart contract",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "ethers": "^5.7.2",
    "express": "^4.18.2",
    "ws": "^8.13.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.13",
    "@types/express": "^4.17.17",
    "@types/node": "^18.15.11",
    "@types/ws": "^8.5.4",
    "ts-node": "^10.9.1",
    "typescript": "^5.0.4"
  }
}
`;
};

/**
 * Generates a tsconfig.json for the TypeScript server
 */
export const generateTsConfig = (): string => {
  return `{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
`;
};

/**
 * Generates a README.md for the TypeScript server
 */
export const generateReadme = (contractName: string): string => {
  return `# ${contractName} MCP Server

This is a Model Context Protocol (MCP) compatible server for the ${contractName} smart contract. It provides both REST API and WebSocket interfaces for interacting with the contract.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

1. Install dependencies:
   \`\`\`
   npm install
   \`\`\`

2. Configure environment variables:
   Create a \`.env\` file with the following variables:
   \`\`\`
   RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
   PRIVATE_KEY=your_private_key_for_state_changing_operations
   PORT=3000
   \`\`\`

3. Start the server:
   \`\`\`
   npm start
   \`\`\`

## API Endpoints

- GET \`/mcp-schema\`: Returns the MCP schema for the contract
- GET \`/gpt-actions-schema\`: Returns the OpenAI GPT Actions schema for the contract
- POST \`/contract/{functionName}\`: Call a contract function

## WebSocket Interface

Connect to \`ws://localhost:3000\` and send JSON messages in the format:

\`\`\`json
{
  "action": "functionName",
  "params": {
    "param1": "value1",
    "param2": "value2"
  }
}
\`\`\`

## Docker Deployment

1. Build the Docker image:
   \`\`\`
   docker build -t ${contractName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-mcp-server .
   \`\`\`

2. Run the container:
   \`\`\`
   docker run -p 3000:3000 -e RPC_URL=your_rpc_url -e PRIVATE_KEY=your_private_key ${contractName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-mcp-server
   \`\`\`

## License

MIT
`;
};

/**
 * Generates a zip file structure for the TypeScript server
 */
export const generateServerFiles = (mcpSchema: string, contractAddress: string, contractName: string): Record<string, string> => {
  return {
    'src/index.ts': generateTypeScriptServer(mcpSchema, contractAddress, contractName),
    'Dockerfile': generateDockerfile(),
    'package.json': generatePackageJson(contractName),
    'tsconfig.json': generateTsConfig(),
    'README.md': generateReadme(contractName),
  };
};