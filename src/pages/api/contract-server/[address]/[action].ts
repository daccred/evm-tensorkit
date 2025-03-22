import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { ethers } from 'ethers';

// Define interfaces for our API
interface ContractFunction {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`[contract-server/address/action] Received ${req.method} request`);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST method for this endpoint
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract path parameters
    const { address, action } = req.query;
    
    // Extract query parameters
    const { schemaType } = req.query;
    
    // Validate required parameters
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Contract address is required' });
    }
    
    if (!action || typeof action !== 'string') {
      return res.status(400).json({ error: 'Action is required' });
    }
    
    if (!schemaType || (schemaType !== 'mcp' && schemaType !== 'gpt')) {
      return res.status(400).json({ error: 'Schema type must be either "mcp" or "gpt"' });
    }

    console.log(`[contract-server/address/action] Looking up contract with address: ${address}`);
    
    // Find the contract by address
    const contract = await prisma.smartContract.findFirst({
      where: { address: { equals: address, mode: 'insensitive' } },
    });

    if (!contract) {
      console.log(`[contract-server/address/action] Contract not found with address: ${address}`);
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Get the appropriate schema based on the schemaType
    const schema = schemaType === 'mcp' ? contract.mcpSchema : contract.gptActionSchema;
    
    if (!schema) {
      console.log(`[contract-server/address/action] ${schemaType.toUpperCase()} schema not found for contract: ${address}`);
      return res.status(404).json({ error: `${schemaType.toUpperCase()} schema not found for this contract` });
    }

    // Parse the schema
    const parsedSchema = JSON.parse(schema);
    
    // Find the requested action in the schema
    let actionSchema: ContractFunction | null = null;
    
    if (schemaType === 'mcp') {
      actionSchema = parsedSchema.find((item: any) => item.name === action);
    } else {
      // For GPT schema, the structure is different
      const gptAction = parsedSchema.find((item: any) => 
        item.function && item.function.name === action
      );
      actionSchema = gptAction ? gptAction.function : null;
    }
    
    if (!actionSchema) {
      console.log(`[contract-server/address/action] Action not found: ${action}`);
      return res.status(404).json({ error: `Action "${action}" not found` });
    }
    
    // Get the parameters from the request body
    const params = req.body;
    
    // Validate required parameters
    const requiredParams = actionSchema.parameters.required;
    const missingParams = requiredParams.filter(param => params[param] === undefined);
    
    if (missingParams.length > 0) {
      console.log(`[contract-server/address/action] Missing required parameters: ${missingParams.join(', ')}`);
      return res.status(400).json({ 
        error: 'Missing required parameters', 
        missingParams 
      });
    }
    
    // Initialize ethers provider based on the network
    let provider;
    try {
      // Use appropriate provider based on network
      if (contract.network === 'mainnet') {
        provider = new ethers.providers.JsonRpcProvider(
          process.env.MAINNET_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo'
        );
      } else if (contract.network === 'goerli') {
        provider = new ethers.providers.JsonRpcProvider(
          process.env.GOERLI_RPC_URL || 'https://eth-goerli.g.alchemy.com/v2/demo'
        );
      } else if (contract.network === 'sepolia') {
        provider = new ethers.providers.JsonRpcProvider(
          process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo'
        );
      } else {
        // Default to mainnet
        provider = new ethers.providers.JsonRpcProvider(
          process.env.MAINNET_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo'
        );
      }
    } catch (error) {
      console.error('[contract-server/address/action] Error initializing provider:', error);
      return res.status(500).json({ error: 'Failed to initialize blockchain provider' });
    }
    
    // Initialize contract instance
    try {
      const contractInstance = new ethers.Contract(contract.address, JSON.parse(contract.abiJson), provider);
      
      // Check if the function exists on the contract
      if (!contractInstance.functions[action]) {
        console.log(`[contract-server/address/action] Function not found on contract: ${action}`);
        return res.status(404).json({ error: `Function "${action}" not found on contract` });
      }
      
      // Determine if the function is read-only or state-changing
      const isStateChanging = !actionSchema.description.includes('does not modify blockchain state');
      
      if (isStateChanging) {
        console.log(`[contract-server/address/action] State-changing operation requested: ${action}`);
        // For state-changing operations, we would need a signer
        // This is just a simulation endpoint, so we return a message
        return res.status(200).json({ 
          simulation: true,
          message: 'This is a simulation of a state-changing operation. In a production environment, this would require a signer with ETH to pay for gas.',
          function: action,
          parameters: params,
          estimatedGas: 'Not calculated in simulation mode'
        });
      } else {
        // For read-only functions, we can call them directly
        console.log(`[contract-server/address/action] Calling read-only function: ${action}`);
        
        // Extract the parameters in the correct order
        const functionParams = requiredParams.map(param => params[param]);
        
        // Call the contract function
        const result = await contractInstance[action](...functionParams);
        
        // Format the result for better readability
        let formattedResult = result;
        
        // Handle BigNumber results
        if (ethers.BigNumber.isBigNumber(result)) {
          formattedResult = {
            type: 'BigNumber',
            hex: result.toHexString(),
            decimal: result.toString(),
            formatted: ethers.utils.formatUnits(result, 0)
          };
        }
        
        // Handle array results
        if (Array.isArray(result)) {
          formattedResult = result.map(item => {
            if (ethers.BigNumber.isBigNumber(item)) {
              return {
                type: 'BigNumber',
                hex: item.toHexString(),
                decimal: item.toString(),
                formatted: ethers.utils.formatUnits(item, 0)
              };
            }
            return item;
          });
        }
        
        console.log(`[contract-server/address/action] Function call successful: ${action}`);
        return res.status(200).json({ 
          success: true, 
          function: action,
          parameters: params,
          result: formattedResult
        });
      }
    } catch (error: any) {
      console.error(`[contract-server/address/action] Error calling contract function ${action}:`, error);
      return res.status(500).json({ 
        error: `Failed to call contract function "${action}"`,
        details: error?.message || String(error)
      });
    }
  } catch (error: any) {
    console.error('[contract-server/address/action] Unexpected error:', error);
    return res.status(500).json({ 
      error: 'An unexpected error occurred', 
      details: error?.message || String(error) 
    });
  }
}