import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { ethers } from 'ethers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`[contract-server/address] Received ${req.method} request`);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET method for this endpoint
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract path parameters
    const { address } = req.query;
    
    // Extract query parameters
    const { schemaType } = req.query;
    
    // Validate required parameters
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Contract address is required' });
    }
    
    if (!schemaType || (schemaType !== 'mcp' && schemaType !== 'gpt')) {
      return res.status(400).json({ error: 'Schema type must be either "mcp" or "gpt"' });
    }

    console.log(`[contract-server/address] Looking up contract with address: ${address}`);
    
    // Find the contract by address
    const contract = await prisma.smartContract.findFirst({
      where: { address: { equals: address, mode: 'insensitive' } },
    });

    if (!contract) {
      console.log(`[contract-server/address] Contract not found with address: ${address}`);
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Get the appropriate schema based on the schemaType
    const schema = schemaType === 'mcp' ? contract.mcpSchema : contract.gptActionSchema;
    
    if (!schema) {
      console.log(`[contract-server/address] ${schemaType.toUpperCase()} schema not found for contract: ${address}`);
      return res.status(404).json({ error: `${schemaType.toUpperCase()} schema not found for this contract` });
    }

    // Parse the schema
    const parsedSchema = JSON.parse(schema);
    
    // Extract function names for easier reference
    const availableActions = parsedSchema.map((item: any) => {
      // Handle different schema formats
      const func = schemaType === 'gpt' ? item.function : item;
      return {
        name: func.name,
        description: func.description,
        parameters: func.parameters.required
      };
    });
    
    console.log(`[contract-server/address] Returning schema for contract: ${address}`);
    return res.status(200).json({
      contract: {
        address: contract.address,
        name: contract.name,
        network: contract.network
      },
      schema: parsedSchema,
      availableActions
    });
  } catch (error) {
    console.error('[contract-server/address] Unexpected error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred', details: error.message });
  }
}