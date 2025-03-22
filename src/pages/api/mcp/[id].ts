import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Contract ID is required' });
    }

    // Get the contract
    const contract = await prisma.smartContract.findUnique({
      where: { id },
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Check if MCP schema exists
    if (!contract.mcpSchema) {
      return res.status(404).json({ error: 'MCP schema not found for this contract' });
    }

    // Set appropriate headers for JSON response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Return the MCP schema
    return res.status(200).send(contract.mcpSchema);
  } catch (error) {
    console.error('Error serving MCP schema:', error);
    return res.status(500).json({ error: 'Failed to serve MCP schema' });
  }
}